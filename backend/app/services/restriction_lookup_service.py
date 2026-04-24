"""Fetches and caches bay type information from the CoM restrictions dataset.

Provides a lookup dict {deviceid -> bay_type} used to enrich parking bay records.
The key is ``deviceid`` from the restrictions API which equals ``kerbsideid`` in
the sensor API — these share the same ID namespace.  ``bayid`` is a different
CoM-internal namespace and must NOT be used for joining.

Architecture: same background-refresh, read-cache-only model as parking_service.
  - start_background_restrictions_refresh() launches a background task (call once at startup).
  - The task refreshes the lookup once per REFRESH_INTERVAL (1 hour).
  - fetch_restrictions_lookup() is a pure cache reader — it NEVER calls upstream.
  - On refresh failure, stale cache is preserved (never cleared on error).
  - If cache is empty (first refresh failed), fetch_restrictions_lookup() returns {}.
    /api/parking will still respond with bay_type="Other" for all bays, which is
    acceptable degraded behaviour.
"""

import asyncio
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_ODS_BASE = (
    "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
    "/on-street-car-park-bay-restrictions"
)
# Primary: /exports/json — full dataset in one request (no 100-record cap).
# Fallback: /records — paginated, works without API key.
_EXPORTS_URL = f"{_ODS_BASE}/exports/json"
_RECORDS_URL = f"{_ODS_BASE}/records"
ODS_PAGE_SIZE = 100
REQUEST_TIMEOUT = 60   # generous for a single large export response
REFRESH_INTERVAL = 3600  # refresh once per hour

# ---------------------------------------------------------------------------
# Restrictions lookup cache
#
# Design: system-driven refresh, user read-cache-only.
#   - _background_refresh_loop() is the ONLY writer.
#   - fetch_restrictions_lookup() is a pure reader — never touches upstream.
#   - If cache is empty, returns {} (bays get bay_type="Other"; not fatal).
# ---------------------------------------------------------------------------

_cache: dict[int, str] = {}
_cache_lock = asyncio.Lock()


def _map_type_desc(raw: Optional[str]) -> str:
    """Map a raw TypeDesc value to a frontend-friendly bay_type category.

    Only absolute-restriction categories are mapped — these come directly from
    CoM's native typedesc1 tags ("Disabled", "Loading Zone", "No Standing") and
    don't drift.

    Timed/meter guessing retired 2026-04: the tier-1 DB path covers 97.3% of
    bays with validated per-slot rules from build_gold, so the remaining sliver
    of metered bays not in the DB now routes to "unknown — check signage"
    rather than returning a string-match guess.
    """
    if not raw:
        return "Other"
    t = raw.lower()
    if "disabled" in t or " dis" in t or t.startswith("dis"):
        return "Disabled"
    if "loading" in t:
        return "Loading Zone"
    if "no standing" in t:
        return "No Standing"
    return "Other"


def _extract_type_desc(record: dict) -> Optional[str]:
    """Extract TypeDesc from a record regardless of exact field name casing.

    The raw CoM API returns both ``description1`` (human-readable sign text)
    and ``typedesc1`` (category code).  Either works for bay-type classification.
    """
    for key in ("typedesc1", "description1", "typedesc", "type_desc", "TypeDesc"):
        val = record.get(key)
        if val is not None:
            return str(val)
    return None


def _extract_bay_id(record: dict) -> Optional[int]:
    """Extract the bay identifier used to join with sensor data.

    The correct join key is ``deviceid`` (restrictions) = ``kerbsideid`` (sensors).
    ``bayid`` is a different CoM-internal namespace and must NOT be used here.
    """
    for key in ("deviceid", "device_id", "DeviceId"):
        if key in record and record[key] is not None:
            try:
                return int(record[key])
            except (ValueError, TypeError):
                pass
    return None


def _build_lookup(records: list[dict]) -> dict[int, str]:
    """Convert a flat list of raw restriction records into a {bay_id: bay_type} dict."""
    lookup: dict[int, str] = {}
    for record in records:
        bay_id = _extract_bay_id(record)
        if bay_id is None:
            continue
        if bay_id not in lookup:
            lookup[bay_id] = _map_type_desc(_extract_type_desc(record))
    return lookup


async def _fetch_via_exports(client: httpx.AsyncClient) -> list[dict]:
    """Fetch all restriction records in one request via /exports/json."""
    response = await client.get(
        _EXPORTS_URL,
        params={"limit": -1},
        headers={"User-Agent": "MelOPark/1.0"},
    )
    response.raise_for_status()
    records = response.json()
    if not isinstance(records, list):
        raise ValueError(
            f"Unexpected exports response type: {type(records).__name__}. "
            f"First 200 chars: {str(records)[:200]}"
        )
    return records


async def _fetch_via_records(client: httpx.AsyncClient) -> list[dict]:
    """Fetch all restriction records via paginated /records (100 per page)."""
    records: list[dict] = []
    offset = 0
    while True:
        response = await client.get(
            _RECORDS_URL,
            params={"limit": ODS_PAGE_SIZE, "offset": offset},
            headers={"User-Agent": "MelOPark/1.0"},
        )
        response.raise_for_status()
        payload = response.json()
        batch = payload.get("results", [])
        if not batch:
            break
        records.extend(batch)
        offset += len(batch)
        if offset >= payload.get("total_count", 0):
            break
    return records


async def _fetch_restrictions_from_upstream() -> dict[int, str]:
    """Fetch all restriction records and return a {bay_id: bay_type} dict.

    Strategy (mirrors parking_service):
      1. Try /exports/json — full dataset in one HTTP request.
      2. If 401/403/429, fall back to paginated /records.
    """
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            raw = await _fetch_via_exports(client)
            logger.info(
                "Restrictions fetch via /exports/json — %d raw records", len(raw)
            )
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in (401, 403, 429):
                logger.warning(
                    "Restrictions /exports/json returned HTTP %s. "
                    "Falling back to paginated /records.",
                    status,
                )
                raw = await _fetch_via_records(client)
                logger.info(
                    "Restrictions fetch via /records (paginated) — %d raw records",
                    len(raw),
                )
            else:
                raise
    return _build_lookup(raw)


async def _refresh_restrictions_cache() -> bool:
    """Fetch fresh restrictions data and atomically replace the cache.

    Returns True if the upstream responded with 429 (rate-limited),
    False otherwise (success or other error).
    On any failure, the existing cache is kept intact (never cleared on error).
    """
    global _cache
    try:
        fresh = await _fetch_restrictions_from_upstream()
        async with _cache_lock:
            _cache = fresh
        logger.info("Restrictions cache refreshed — %d bays mapped", len(fresh))
        return False
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            logger.warning(
                "Restrictions cache refresh rate-limited (429). Stale cache preserved."
            )
            return True  # signal backoff to caller
        logger.warning("Failed to refresh restrictions lookup: %s", exc)
        return False
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to refresh restrictions lookup: %s", exc)
        return False


async def _background_refresh_loop() -> None:
    """Runs forever: refresh immediately on startup, then every REFRESH_INTERVAL.

    On upstream 429, backs off for 2 hours before retrying to avoid
    extending the rate-limit window on a sliding-window quota system.
    """
    while True:
        rate_limited = await _refresh_restrictions_cache()
        if rate_limited:
            backoff = 2 * 3600  # 2 hours
            logger.warning(
                "Restrictions upstream rate-limited (429). Backing off for %d hours.",
                backoff // 3600,
            )
            await asyncio.sleep(backoff)
        else:
            await asyncio.sleep(REFRESH_INTERVAL)


async def start_background_restrictions_refresh() -> None:
    """Launch the restrictions cache background loop as a fire-and-forget asyncio task.

    Call once from the FastAPI lifespan startup hook.
    """
    asyncio.create_task(_background_refresh_loop())


async def fetch_restrictions_lookup() -> dict[int, str]:
    """Return a copy of the current cached {bay_id: bay_type} lookup.

    This function NEVER fetches from upstream — it only reads the cache.
    Returns an empty dict if the cache has not yet been filled (bays will
    show bay_type='Other', which is acceptable degraded behaviour).
    """
    async with _cache_lock:
        return dict(_cache)


def get_cached_bay_type(bay_id_str: str) -> Optional[str]:
    """Synchronously return the cached bay_type string for a given bay_id.

    Safe to call from synchronous code (e.g. SQLAlchemy route handlers)
    because reading a Python dict is thread-safe.

    Returns None if bay_id cannot be parsed or is not in the cache.
    Returns "Other" if the bay is cached but has no meaningful type.
    """
    try:
        bay_id_int = int(bay_id_str)
    except (ValueError, TypeError):
        return None
    return _cache.get(bay_id_int)  # None if not found
