"""Service layer for Melbourne Open Data parking API."""

import asyncio
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_ODS_BASE = (
    "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
    "/on-street-parking-bay-sensors"
)
# Primary: /exports/json returns all records in one request (no 100-record cap).
# Fallback: /records is paginated (100/page) but works without an API key.
_EXPORTS_URL = f"{_ODS_BASE}/exports/json"
_RECORDS_URL = f"{_ODS_BASE}/records"
ODS_PAGE_SIZE = 100    # hard cap for /records endpoint
REQUEST_TIMEOUT = 60   # seconds — generous for a single large export response

SENSOR_REFRESH_INTERVAL = 5 * 60  # 5 minutes — matches frontend poll interval

# ---------------------------------------------------------------------------
# Sensor data cache
#
# Design: system-driven refresh, user read-cache-only.
#   - _background_refresh_loop() is the ONLY writer.
#   - fetch_raw_parking_bays() is a pure reader — never touches upstream.
#   - Cache is pre-filled at startup so the first user request always has data.
#   - On refresh failure, stale cache is preserved (never cleared on error).
# ---------------------------------------------------------------------------

_sensor_cache: list[dict] = []
_sensor_cache_lock = asyncio.Lock()


async def _fetch_via_exports(client: httpx.AsyncClient) -> list[dict]:
    """Fetch all records in one request via the /exports/json endpoint.

    Returns a list of raw record dicts.
    Raises httpx.HTTPStatusError if the server rejects the request (e.g. 403 auth required).
    """
    response = await client.get(_EXPORTS_URL, params={"limit": -1})
    response.raise_for_status()
    records = response.json()
    if not isinstance(records, list):
        raise ValueError(
            f"Unexpected exports response type: {type(records).__name__} "
            f"(expected list). First 200 chars: {str(records)[:200]}"
        )
    return records


async def _fetch_via_records(client: httpx.AsyncClient, max_records: int = 5000) -> list[dict]:
    """Fetch all records via paginated /records endpoint (100 per page).

    Falls back to this when /exports/json is unavailable (e.g. auth required).
    """
    records: list[dict] = []
    offset = 0
    while len(records) < max_records:
        batch_size = min(ODS_PAGE_SIZE, max_records - len(records))
        response = await client.get(
            _RECORDS_URL,
            params={"limit": batch_size, "offset": offset},
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


async def _fetch_raw_from_upstream() -> list[dict]:
    """Fetch all parking sensor records from the CoM Open Data API.

    Strategy (in order):
      1. Try /exports/json — returns all records in a single HTTP request.
         This is optimal: 1 request instead of 50+ for 5 000 records.
      2. If /exports/json returns 403/401 (API key required on this portal),
         fall back to paginated /records (100 records per page, ~50 requests).

    This is a private function — only the background refresh task should call it.
    """
    async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
        try:
            records = await _fetch_via_exports(client)
            logger.info("Upstream fetch via /exports/json — %d records", len(records))
            return records
        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in (401, 403, 429):
                # 401/403: exports requires API key on this portal.
                # 429: exports quota exhausted — try records (same quota, but worth one attempt).
                logger.warning(
                    "/exports/json returned HTTP %s. Falling back to paginated /records.",
                    status,
                )
                records = await _fetch_via_records(client)
                logger.info(
                    "Upstream fetch via /records (paginated) — %d records", len(records)
                )
                return records
            raise  # re-raise 5xx, etc.


async def _refresh_sensor_cache() -> bool:
    """Fetch fresh data from upstream and atomically replace the cache.

    Returns True if the upstream responded with 429 (rate-limited),
    False otherwise (success or other error).
    On any failure, the existing cache is kept intact.
    """
    global _sensor_cache
    try:
        fresh = await _fetch_raw_from_upstream()
        async with _sensor_cache_lock:
            _sensor_cache = fresh
        logger.info("Sensor cache refreshed — %d records", len(fresh))
        return False
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 429:
            logger.warning(
                "Sensor cache refresh rate-limited (429). Stale cache preserved."
            )
            return True  # signal backoff to caller
        logger.warning("Sensor cache refresh failed, keeping stale data: %s", exc)
        return False
    except Exception as exc:  # noqa: BLE001
        logger.warning("Sensor cache refresh failed, keeping stale data: %s", exc)
        return False


async def _background_refresh_loop() -> None:
    """Runs forever: refresh immediately on startup, then every 5 minutes.

    On upstream 429 (rate-limited), backs off for 30 minutes before retrying
    to avoid hammering an exhausted quota and extending the blackout window.
    """
    while True:
        rate_limited = await _refresh_sensor_cache()
        if rate_limited:
            backoff = 30 * 60  # 30 minutes — let quota recover
            logger.warning(
                "Sensor upstream rate-limited (429). Backing off for %d minutes.",
                backoff // 60,
            )
            await asyncio.sleep(backoff)
        else:
            await asyncio.sleep(SENSOR_REFRESH_INTERVAL)


async def start_background_refresh() -> None:
    """Launch the sensor cache background loop as a fire-and-forget asyncio task.

    Call once from the FastAPI lifespan startup hook.
    The first refresh runs immediately (before the first user request arrives),
    so the cache is pre-filled when the application is ready.
    """
    asyncio.create_task(_background_refresh_loop())


class SensorCacheEmptyError(RuntimeError):
    """Raised when the sensor cache has not yet been populated.

    This happens only in the brief window between server startup and the
    completion of the first background refresh, or when all refresh attempts
    have been failing (e.g. upstream 429).
    """


async def fetch_raw_parking_bays() -> list[dict]:
    """Return a copy of the current cached sensor data.

    This function NEVER fetches from upstream — it only reads the cache.
    Raises SensorCacheEmptyError if the cache has not yet been filled,
    so callers can return a proper error response instead of silent empty data.
    """
    async with _sensor_cache_lock:
        cached = list(_sensor_cache)
    if not cached:
        raise SensorCacheEmptyError(
            "Parking sensor cache is empty — background refresh has not completed yet "
            "or all upstream refresh attempts are currently failing (upstream may be rate-limiting)."
        )
    return cached


# ---------------------------------------------------------------------------
# Transformation helpers
# ---------------------------------------------------------------------------

_STATUS_MAP: dict[str, str] = {
    "unoccupied": "free",
    "present": "occupied",
    "occupied": "occupied",
}


def _map_status(raw_status: str) -> str:
    return _STATUS_MAP.get(raw_status.lower().strip(), "unknown")


def _transform_bay(raw: dict) -> Optional[dict]:
    """Convert a raw CoM record to a frontend-friendly bay dict.

    Returns None if the record has no usable lat/lng.

    ``street_name`` is sourced from the ``roadsegmentdescription`` field in the
    CoM sensor dataset — it is the authoritative street name for this bay.
    """
    location = raw.get("location") or {}
    lat = location.get("lat")
    lon = location.get("lon")
    if lat is None or lon is None:
        return None
    return {
        "bay_id": raw.get("kerbsideid"),
        "lat": lat,
        "lng": lon,
        "status": _map_status(raw.get("status_description", "")),
        "last_updated": raw.get("lastupdated"),
        # Real street name from CoM sensor data — use as-is or fall back to None.
        "street_name": raw.get("roadsegmentdescription") or None,
    }


async def fetch_parking_bays() -> list[dict]:
    """Return transformed parking bay records enriched with bay_type.

    Reads sensor data from cache only; fetches restrictions lookup in parallel
    (restrictions have their own 1-hour cache in restriction_lookup_service).
    """
    from app.services.restriction_lookup_service import fetch_restrictions_lookup

    raw_records, restrictions = await asyncio.gather(
        fetch_raw_parking_bays(),
        fetch_restrictions_lookup(),
    )

    result = []
    for r in raw_records:
        bay = _transform_bay(r)
        if bay is None:
            continue
        bay_id = bay["bay_id"]
        has_rules = bay_id in restrictions or (
            isinstance(bay_id, str) and bay_id.isdigit() and int(bay_id) in restrictions
        )
        bay["bay_type"] = restrictions.get(bay_id, restrictions.get(int(bay_id) if isinstance(bay_id, str) and bay_id.isdigit() else bay_id, "Other"))
        bay["has_restriction_data"] = has_rules
        result.append(bay)
    return result
