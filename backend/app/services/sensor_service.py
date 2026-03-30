"""
Sensor service - fetches and caches live bay data from City of Melbourne.

Uses the SODA API (Socrata Open Data API) endpoint. The data refreshes
every few minutes on the CoM side. We cache for CACHE_TTL seconds
to avoid redundant requests.
"""

import os
import time
import requests

# CoM SODA API endpoint for live sensors
COM_SENSORS_URL = (
    "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
    "/on-street-parking-bay-sensors/records"
)

# Explore API only accepts -1 <= limit <= 100 (5000+ returns HTTP 400).
_PAGE_SIZE = 100

CACHE_TTL = int(os.getenv("SENSOR_CACHE_TTL", "60"))  # seconds

_cache = {
    "data": None,
    "fetched_at": 0,
}


def get_live_sensors():
    """
    Return a list of sensor dicts with standardised keys.
    Uses a simple in-memory cache.
    """
    now = time.time()

    if _cache["data"] is not None and (now - _cache["fetched_at"]) < CACHE_TTL:
        return _cache["data"]

    try:
        sensors = _fetch_from_com()
        _cache["data"] = sensors
        _cache["fetched_at"] = now
        return sensors
    except Exception as e:
        print(f"[sensor_service] Error fetching sensors: {e}")
        # Return stale cache if available
        if _cache["data"] is not None:
            return _cache["data"]
        return None


def _fetch_from_com():
    """
    Pull all sensor records from the CoM API.

    The Explore API caps ``limit`` at 100, so we page with ``offset`` until a short page.

    Field names follow the current Explore API dataset (kerbsideid, status_description,
    nested location); older schemas used bay_id / st_marker_id and top-level lat/lon.
    """
    select = (
        "kerbsideid,zone_number,status_description,location,"
        "lastupdated,status_timestamp"
    )
    records = []
    offset = 0

    while True:
        params = {
            "limit": _PAGE_SIZE,
            "offset": offset,
            "select": select,
        }
        resp = requests.get(COM_SENSORS_URL, params=params, timeout=60)
        resp.raise_for_status()
        raw = resp.json()
        batch = raw.get("results", [])
        records.extend(batch)
        if not batch or len(batch) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE

    # Standardise into a clean format (frontend expects bay_id, status Present|Unoccupied)
    sensors = []
    for r in records:
        lat, lon = r.get("lat"), r.get("lon")
        if lat is None or lon is None:
            loc = r.get("location") or {}
            lat = lat if lat is not None else loc.get("lat")
            lon = lon if lon is not None else loc.get("lon")

        if lat is None or lon is None:
            continue

        kid = r.get("kerbsideid")
        status = r.get("status_description") or r.get("status") or "Unknown"

        sensors.append({
            "bay_id": str(kid) if kid is not None else None,
            "marker_id": r.get("zone_number"),
            "status": status,
            "lat": float(lat),
            "lon": float(lon),
            "last_updated": r.get("lastupdated"),
            "is_stale": _is_stale(r.get("lastupdated")),
        })

    return sensors


def _is_stale(timestamp_str):
    """
    Check if a sensor reading is older than 15 minutes.
    Returns True if stale or unparseable.
    """
    if not timestamp_str:
        return True

    try:
        from datetime import datetime, timezone, timedelta

        # CoM timestamps look like "2026-03-28T14:23:00+11:00" or similar
        # Try parsing with timezone
        ts = datetime.fromisoformat(timestamp_str)
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)

        age = datetime.now(timezone.utc) - ts
        return age > timedelta(minutes=15)
    except (ValueError, TypeError):
        return True
