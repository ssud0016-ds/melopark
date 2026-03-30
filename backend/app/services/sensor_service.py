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
    The API paginates at 100 by default; we request up to 5000.
    """
    params = {
        "limit": 5000,
        "select": "bay_id,st_marker_id,status,lat,lon,location,lastupdated",
    }

    resp = requests.get(COM_SENSORS_URL, params=params, timeout=30)
    resp.raise_for_status()
    raw = resp.json()

    records = raw.get("results", [])

    # Standardise into a clean format
    sensors = []
    for r in records:
        lat = r.get("lat")
        lon = r.get("lon")

        # Some records store coords in a nested "location" field
        if lat is None and r.get("location"):
            loc = r["location"]
            lat = loc.get("lat")
            lon = loc.get("lon")

        if lat is None or lon is None:
            continue

        sensors.append({
            "bay_id": r.get("bay_id"),
            "marker_id": r.get("st_marker_id"),
            "status": r.get("status", "Unknown"),
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
