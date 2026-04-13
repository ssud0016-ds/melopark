"""Fetches and caches bay type information from the CoM restrictions dataset.

Provides a lookup dict {bay_id -> bay_type} used to enrich parking bay records.
The lookup is refreshed at most once per CACHE_TTL_SECONDS to avoid hammering
the upstream API on every request.
"""

import time

import httpx

COM_RESTRICTIONS_URL = (
    "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
    "/on-street-car-park-bay-restrictions/records"
)
ODS_PAGE_SIZE = 100
REQUEST_TIMEOUT = 15
CACHE_TTL_SECONDS = 3600  # refresh restrictions lookup once per hour

# Module-level cache
_cache: dict[int, str] = {}
_cache_ts: float = 0.0


def _map_type_desc(raw: str | None) -> str:
    """Map a raw TypeDesc value to a frontend-friendly bay_type category."""
    if not raw:
        return "Other"
    t = raw.lower()
    if "disabled" in t or " dis" in t or t.startswith("dis"):
        return "Disabled"
    if "loading" in t:
        return "Loading Zone"
    if "no standing" in t:
        return "No Standing"
    if "meter" in t:
        return "Timed"
    return "Other"


def _extract_type_desc(record: dict) -> str | None:
    """Extract TypeDesc from a record regardless of exact field name casing."""
    for key in ("typedesc", "type_desc", "TypeDesc", "TYPEDESC"):
        if key in record:
            return record[key]
    return None


def _extract_bay_id(record: dict) -> int | None:
    """Extract the bay identifier used to join with sensor data."""
    for key in ("bay_id", "bayid", "BayId", "BAY_ID"):
        if key in record and record[key] is not None:
            try:
                return int(record[key])
            except (ValueError, TypeError):
                pass
    return None


async def fetch_restrictions_lookup(force_refresh: bool = False) -> dict[int, str]:
    """Return a cached {bay_id: bay_type} lookup dict.

    Fetches fresh data from CoM if the cache is empty or has expired.
    On upstream failure, returns the stale cache (or an empty dict).
    """
    global _cache, _cache_ts

    if not force_refresh and _cache and (time.monotonic() - _cache_ts) < CACHE_TTL_SECONDS:
        return _cache

    lookup: dict[int, str] = {}
    offset = 0

    try:
        async with httpx.AsyncClient(timeout=REQUEST_TIMEOUT) as client:
            while True:
                response = await client.get(
                    COM_RESTRICTIONS_URL,
                    params={"limit": ODS_PAGE_SIZE, "offset": offset},
                    headers={"User-Agent": "MelOPark/1.0"},
                )
                response.raise_for_status()
                payload = response.json()
                batch = payload.get("results", [])
                if not batch:
                    break

                for record in batch:
                    bay_id = _extract_bay_id(record)
                    if bay_id is None:
                        continue
                    type_desc = _extract_type_desc(record)
                    bay_type = _map_type_desc(type_desc)
                    # Only store the first restriction found per bay
                    if bay_id not in lookup:
                        lookup[bay_id] = bay_type

                offset += len(batch)
                total = payload.get("total_count", 0)
                if offset >= total:
                    break

        _cache = lookup
        _cache_ts = time.monotonic()

    except Exception as exc:  # noqa: BLE001
        # Return stale cache on failure rather than breaking /api/parking
        import logging
        logging.warning("Failed to refresh restrictions lookup: %s", exc)
        if not _cache:
            return {}

    return _cache
