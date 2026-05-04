"""Service layer for Melbourne Open Data parking API."""

import asyncio
import logging
import time
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DB street-name lookup cache
#
# The live sensor feed only provides roadsegmentdescription for ~2k bays.
# The bays table (populated by build_gold pipeline from parking_bays.parquet)
# has street_name for 5k+ bays.  We load a bay_id -> street_name map from
# the DB once (lazily, on first miss) and refresh it every 10 minutes.
# ---------------------------------------------------------------------------

_street_name_cache: dict[str, str] = {}
_street_name_cache_ts: float = 0.0
_STREET_CACHE_TTL_SEC = 600  # 10 minutes

_duration_map_cache: dict[str, int] = {}
_duration_map_ts: float = 0.0

# Gold parquet loaded once at startup for duration queries
_gold_df = None

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

# On-demand cache (Lambda-friendly): TTL + single in-flight refresh task.
SENSOR_CACHE_TTL_SEC = 300  # 5 minutes
WAIT_INFLIGHT_NO_STALE_SEC = 3.0  # concurrent waiters without stale data
MIN_UPSTREAM_RETRY_AFTER_FAIL_SEC = 10.0

# ---------------------------------------------------------------------------
# Sensor data cache
#
# Design (hybrid):
#   - Long-lived servers: optional _background_refresh_loop() keeps cache warm.
#   - Lambda / cold starts: fetch_raw_parking_bays() triggers on-demand refresh
#     when TTL expired or cache empty (single asyncio.Task per refresh wave).
#   - On upstream failure, stale cache is preserved (never cleared on error).
# ---------------------------------------------------------------------------

_sensor_cache: list[dict] = []
_sensor_cache_lock = asyncio.Lock()
_sensor_cache_ts_mono: float = 0.0
_last_upstream_fail_mono: Optional[float] = None

_refresh_task: Optional[asyncio.Task] = None
_refresh_task_lock = asyncio.Lock()
# Ensures at most one upstream HTTP fetch at a time (background loop + on-demand).
_upstream_fetch_lock = asyncio.Lock()

# Lazily-rebuilt set of bay_ids present in _sensor_cache.  Used by the restriction
# evaluator to tag BayEvaluation.data_coverage ("full" vs "rules_only").
# Regenerated whenever _sensor_cache_ts_mono changes so the check stays cheap.
_sensor_ids: set[str] = set()
_sensor_ids_built_for_ts: float = -1.0


def has_live_sensor(bay_id: str) -> bool:
    """Return True if *bay_id* currently has a row in the live sensor cache.

    Synchronous, dict-lookup-cheap.  Safe to call from SQLAlchemy handlers.
    Rebuilds a set-of-ids from the list cache only when a new refresh has
    landed (tracked by _sensor_cache_ts_mono), so the common case is O(1).
    Returns False when the cache is empty.
    """
    global _sensor_ids, _sensor_ids_built_for_ts
    if _sensor_cache_ts_mono != _sensor_ids_built_for_ts:
        _sensor_ids = {
            str(r.get("kerbsideid"))
            for r in _sensor_cache
            if r.get("kerbsideid") is not None
        }
        _sensor_ids_built_for_ts = _sensor_cache_ts_mono
    return str(bay_id) in _sensor_ids


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

    Called from on-demand refresh and from the optional background refresh loop.
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


async def _refresh_from_upstream_once() -> bool:
    """Fetch fresh data from upstream and atomically replace the cache.

    Returns True if the upstream responded with 429 (rate-limited),
    False otherwise (success or other error).
    On any failure, the existing cache is kept intact.
    """
    global _sensor_cache, _sensor_cache_ts_mono, _last_upstream_fail_mono
    async with _upstream_fetch_lock:
        try:
            fresh = await _fetch_raw_from_upstream()
            async with _sensor_cache_lock:
                _sensor_cache = fresh
                _sensor_cache_ts_mono = time.monotonic()
                _last_upstream_fail_mono = None
            logger.info("Sensor cache refreshed — %d records", len(fresh))
            return False
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 429:
                logger.warning(
                    "Sensor cache refresh rate-limited (429). Stale cache preserved."
                )
                async with _sensor_cache_lock:
                    _last_upstream_fail_mono = time.monotonic()
                return True  # signal backoff to caller
            logger.warning("Sensor cache refresh failed, keeping stale data: %s", exc)
            async with _sensor_cache_lock:
                _last_upstream_fail_mono = time.monotonic()
            return False
        except Exception as exc:  # noqa: BLE001
            logger.warning("Sensor cache refresh failed, keeping stale data: %s", exc)
            async with _sensor_cache_lock:
                _last_upstream_fail_mono = time.monotonic()
            return False


async def _refresh_task_wrapper() -> None:
    """Runs inside asyncio.Task — never raises to callers awaiting the task."""
    try:
        await _refresh_from_upstream_once()
    except Exception:  # noqa: BLE001
        logger.exception("Sensor refresh task crashed unexpectedly")


async def _background_refresh_loop() -> None:
    """Runs forever: refresh immediately on startup, then every 5 minutes.

    On upstream 429 (rate-limited), backs off for 30 minutes before retrying
    to avoid hammering an exhausted quota and extending the blackout window.
    """
    while True:
        rate_limited = await _refresh_from_upstream_once()
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
    """Raised when there is no sensor data to return (no cache and upstream failed)."""


async def fetch_raw_parking_bays() -> list[dict]:
    """Return sensor rows: cache-first with TTL, then on-demand upstream fetch.

    Suitable for AWS Lambda: does not require a persistent background loop.
    Raises SensorCacheEmptyError only when there is no usable cache and upstream
    cannot be fetched (or cooldown applies after repeated failures).
    """
    global _refresh_task

    now = time.monotonic()

    async with _sensor_cache_lock:
        if _sensor_cache and (now - _sensor_cache_ts_mono) < SENSOR_CACHE_TTL_SEC:
            return list(_sensor_cache)

    async with _sensor_cache_lock:
        stale_copy: Optional[list[dict]] = list(_sensor_cache) if _sensor_cache else None

    if not stale_copy:
        if _last_upstream_fail_mono is not None:
            if now - _last_upstream_fail_mono < MIN_UPSTREAM_RETRY_AFTER_FAIL_SEC:
                raise SensorCacheEmptyError(
                    "Parking sensor cache is empty and upstream is in a short retry cooldown "
                    f"after a recent failure (wait ~{MIN_UPSTREAM_RETRY_AFTER_FAIL_SEC:.0f}s)."
                )

    async with _sensor_cache_lock:
        if _sensor_cache and (time.monotonic() - _sensor_cache_ts_mono) < SENSOR_CACHE_TTL_SEC:
            return list(_sensor_cache)

    # Stale data is still useful; during post-failure cooldown skip extra upstream work.
    if (
        stale_copy
        and _last_upstream_fail_mono is not None
        and (time.monotonic() - _last_upstream_fail_mono) < MIN_UPSTREAM_RETRY_AFTER_FAIL_SEC
    ):
        return stale_copy

    async with _refresh_task_lock:
        async with _sensor_cache_lock:
            now2 = time.monotonic()
            if _sensor_cache and (now2 - _sensor_cache_ts_mono) < SENSOR_CACHE_TTL_SEC:
                return list(_sensor_cache)

        was_done = _refresh_task is None or _refresh_task.done()
        if was_done:
            _refresh_task = asyncio.create_task(_refresh_task_wrapper())
        t = _refresh_task

    if stale_copy:
        return stale_copy

    try:
        if was_done:
            await t
        else:
            await asyncio.wait_for(asyncio.shield(t), timeout=WAIT_INFLIGHT_NO_STALE_SEC)
    except asyncio.TimeoutError:
        logger.warning(
            "Sensor cache refresh not finished after %.1fs wait",
            WAIT_INFLIGHT_NO_STALE_SEC,
        )

    async with _sensor_cache_lock:
        if _sensor_cache:
            return list(_sensor_cache)

    raise SensorCacheEmptyError(
        "Parking sensor cache is empty and the upstream API could not be reached "
        "or returned no usable data."
    )


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
    Street names: uses sensor feed value when present, otherwise falls back to
    the bays DB table (populated from parking_bays.parquet by the pipeline).
    """
    from app.services.restriction_lookup_service import fetch_restrictions_lookup

    raw_records, restrictions = await asyncio.gather(
        fetch_raw_parking_bays(),
        fetch_restrictions_lookup(),
    )

    # Load street_name and duration fallback maps from DB (cached, 10-min TTL).
    sn_map = _get_street_name_map()
    dur_map = _get_duration_map()

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

        # Street name fallback: prefer sensor feed, then DB lookup.
        if not bay.get("street_name") and bay_id:
            bay["street_name"] = sn_map.get(str(bay_id))

        # Duration: from DB restriction data (most common non-strict rule per bay).
        bay["duration_mins"] = dur_map.get(str(bay_id))

        result.append(bay)
    return result


def _get_street_name_map() -> dict[str, str]:
    """Return a bay_id -> street_name dict from the bays DB table.

    Cached in memory with a 10-minute TTL.  Returns an empty dict if the
    DB is unreachable (graceful degradation — sensor feed names still work).
    """
    global _street_name_cache, _street_name_cache_ts

    now = time.monotonic()
    if _street_name_cache and (now - _street_name_cache_ts) < _STREET_CACHE_TTL_SEC:
        return _street_name_cache

    try:
        from app.core.db import SessionLocal
        from app.models.bay import Bay

        db = SessionLocal()
        try:
            rows = db.query(Bay.bay_id, Bay.street_name).filter(
                Bay.street_name.isnot(None),
                Bay.street_name != "",
            ).all()
            _street_name_cache = {str(r.bay_id): r.street_name for r in rows}
            _street_name_cache_ts = time.monotonic()
            logger.info("Street name cache loaded: %d entries", len(_street_name_cache))
        finally:
            db.close()
    except Exception:  # noqa: BLE001
        logger.warning("Failed to load street name cache from DB — using stale/empty cache")

    return _street_name_cache


_DURATION_CACHE_TTL_SEC = 1800  # 30 minutes — restrictions change throughout the day


def _get_duration_map() -> dict[str, int]:
    """Return a bay_id -> duration_mins dict reflecting restrictions active right now.

    Reads the gold parquet, filters to rows whose day/time window covers the
    current Melbourne time, then takes the minimum (most restrictive) duration
    per bay.  Cached for 30 minutes so it stays reasonably fresh.
    """
    global _duration_map_cache, _duration_map_ts

    now = time.monotonic()
    if _duration_map_cache and (now - _duration_map_ts) < _DURATION_CACHE_TTL_SEC:
        return _duration_map_cache

    try:
        from datetime import datetime as _dt
        from zoneinfo import ZoneInfo

        import pandas as pd

        from app.core.paths import data_gold_dir

        mel_now = _dt.now(ZoneInfo("Australia/Melbourne"))
        # Parquet day encoding: 0=Sun, 1=Mon, …, 6=Sat
        # Python weekday():    0=Mon, …, 5=Sat, 6=Sun  →  (weekday+1) % 7
        data_dow = (mel_now.weekday() + 1) % 7
        current_time = mel_now.strftime("%H:%M")

        path = data_gold_dir() / "gold_accessibility_bays.parquet"
        cols = ["bay_id", "duration_mins", "fromday", "today", "starttime", "endtime"]
        df = pd.read_parquet(path, columns=cols)
        df = df.dropna(subset=["duration_mins", "fromday", "today", "starttime", "endtime"])
        df["fromday"] = df["fromday"].astype(int)
        df["today"] = df["today"].astype(int)
        df["duration_mins"] = df["duration_mins"].astype(int)

        # Vectorised day-range check (handles wrap-around, e.g. Sat=6 → Sun=0)
        no_wrap = df["fromday"] <= df["today"]
        mask_day = (
            (no_wrap & (df["fromday"] <= data_dow) & (data_dow <= df["today"]))
            | (~no_wrap & ((data_dow >= df["fromday"]) | (data_dow <= df["today"])))
        )
        mask_time = (df["starttime"] <= current_time) & (current_time < df["endtime"])

        active = df[mask_day & mask_time]
        duration_by_bay = active.groupby("bay_id")["duration_mins"].min()
        _duration_map_cache = duration_by_bay.to_dict()
        _duration_map_ts = time.monotonic()
        logger.info(
            "Duration map: %d bays active at %s (dow=%d)",
            len(_duration_map_cache), current_time, data_dow,
        )
    except Exception:  # noqa: BLE001
        logger.warning("Failed to load duration map from parquet — using stale/empty cache")

    return _duration_map_cache


def _load_gold_df():
    """Load gold parquet once and cache for the process lifetime."""
    global _gold_df
    if _gold_df is not None:
        return _gold_df
    try:
        import pandas as pd
        from app.core.paths import data_gold_dir
        cols = ["bay_id", "duration_mins", "fromday", "today", "starttime", "endtime"]
        df = pd.read_parquet(data_gold_dir() / "gold_accessibility_bays.parquet", columns=cols)
        df = df.dropna(subset=["fromday", "today", "starttime", "endtime"])
        df["fromday"] = df["fromday"].astype(int)
        df["today"] = df["today"].astype(int)
        df["duration_mins"] = pd.to_numeric(df["duration_mins"], errors="coerce")
        _gold_df = df
        logger.info("Gold parquet loaded: %d rows, %d bays", len(df), df["bay_id"].nunique())
    except Exception:  # noqa: BLE001
        logger.warning("Failed to load gold parquet for duration filter")
        _gold_df = None
    return _gold_df


def get_duration_filtered_bays(needed_mins: int, arrival_time: str, day: int) -> list[str]:
    """Return bay_ids where parking for needed_mins is possible at arrival_time on day.

    day: 0=Sun, 1=Mon, …, 6=Sat  (matches JS Date.getDay() and parquet encoding)
    arrival_time: "HH:MM"

    A bay is included if:
    - It has an active restriction at that time/day with duration_mins >= needed_mins
    - OR it has NO restriction at that time/day (unrestricted → can park as long as needed)
    """
    df = _load_gold_df()
    if df is None:
        return []

    no_wrap = df["fromday"] <= df["today"]
    mask_day = (
        (no_wrap & (df["fromday"] <= day) & (day <= df["today"]))
        | (~no_wrap & ((day >= df["fromday"]) | (day <= df["today"])))
    )
    mask_time = (df["starttime"] <= arrival_time) & (arrival_time < df["endtime"])
    active = df[mask_day & mask_time]

    all_bay_ids = set(df["bay_id"].astype(str).unique())

    if active.empty:
        return list(all_bay_ids)

    restricted_ids = set(active["bay_id"].astype(str).unique())
    unrestricted_ids = all_bay_ids - restricted_ids

    timed = active.dropna(subset=["duration_mins"]).copy()
    timed["bay_id"] = timed["bay_id"].astype(str)
    if not timed.empty:
        max_dur = timed.groupby("bay_id")["duration_mins"].max()
        can_park_ids = set(max_dur[max_dur >= needed_mins].index.tolist())
    else:
        can_park_ids = set()

    return list(can_park_ids | unrestricted_ids)
