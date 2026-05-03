"""Service layer for Epic 5 parking pressure map.

Loads gold parquets at startup, computes live pressure per zone by blending:
  - Live sensor occupancy (from parking_service sensor cache)
  - Historical traffic profile z-scores (from gold parquets)
  - Scheduled event load (from gold event sessions)
"""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timedelta
from functools import lru_cache
from typing import Optional
from zoneinfo import ZoneInfo

import pandas as pd

from app.core.paths import data_gold_dir, data_silver_dir

logger = logging.getLogger(__name__)

GOLD = data_gold_dir()
SILVER = data_silver_dir()

MELB_TZ = ZoneInfo("Australia/Melbourne")

PRESSURE_WEIGHTS = {"occupancy": 0.55, "traffic": 0.30, "events": 0.15}

EVENT_DISTANCE_SIGMA_M = 300
WALK_SPEED_M_PER_MIN = 83.3  # ~5 km/h
MANHATTAN_FACTOR = 1.4


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─────────────────────────────────────────────────────────────────────────────
# Gold data cache (loaded once, refreshed via reload_gold_data)
# ─────────────────────────────────────────────────────────────────────────────
_zone_bay_counts: pd.DataFrame = pd.DataFrame()
_traffic_profile_zone: pd.DataFrame = pd.DataFrame()
_event_sessions: pd.DataFrame = pd.DataFrame()
_zone_hulls_geojson: dict = {}
_gold_loaded: bool = False


def load_gold_data() -> None:
    global _zone_bay_counts, _traffic_profile_zone, _event_sessions
    global _zone_hulls_geojson, _gold_loaded

    try:
        _zone_bay_counts = pd.read_parquet(GOLD / "epic5_zone_bay_counts.parquet")
        _traffic_profile_zone = pd.read_parquet(GOLD / "epic5_traffic_profile_zone.parquet")

        es_path = GOLD / "epic5_event_sessions_gold.parquet"
        if es_path.exists():
            _event_sessions = pd.read_parquet(es_path)
            _event_sessions["session_start"] = pd.to_datetime(
                _event_sessions["session_start"], errors="coerce"
            )
            _event_sessions["session_end"] = pd.to_datetime(
                _event_sessions["session_end"], errors="coerce"
            )
        else:
            _event_sessions = pd.DataFrame()

        hulls_path = GOLD / "epic5_zone_hulls.geojson"
        if hulls_path.exists():
            with open(hulls_path) as f:
                _zone_hulls_geojson = json.load(f)
        else:
            _zone_hulls_geojson = {"type": "FeatureCollection", "features": []}

        _gold_loaded = True
        logger.info(
            "Epic 5 gold loaded: %d zones, %d traffic rows, %d event sessions",
            len(_zone_bay_counts), len(_traffic_profile_zone), len(_event_sessions),
        )
    except FileNotFoundError as e:
        logger.warning("Epic 5 gold data not found: %s — pressure endpoints disabled", e)
        _gold_loaded = False


def is_gold_loaded() -> bool:
    return _gold_loaded


def get_zone_hulls_geojson() -> dict:
    return _zone_hulls_geojson


# ─────────────────────────────────────────────────────────────────────────────
# Live sensor occupancy per zone
# ─────────────────────────────────────────────────────────────────────────────
def _get_zone_occupancy() -> dict[int, dict]:
    """Read current sensor cache and compute occupancy per zone.

    Returns {zone_number: {occupied, total, pct}}.
    """
    from app.services.parking_service import _sensor_cache

    sensors = pd.read_parquet(SILVER / "sensors_clean.parquet")
    sensors = sensors.dropna(subset=["zone_number"]).copy()
    sensors["zone_number"] = sensors["zone_number"].astype(int)

    # Build bay_id -> live status from sensor cache
    live_status = {}
    for rec in _sensor_cache:
        bay_id = rec.get("bay_id") or rec.get("kerbsideid")
        status = rec.get("status") or rec.get("status_description", "")
        if bay_id:
            live_status[str(bay_id)] = status.lower() if isinstance(status, str) else ""

    sensors["live_status"] = sensors["bay_id"].astype(str).map(live_status)
    sensors["is_occupied"] = sensors["live_status"].apply(
        lambda s: 1 if isinstance(s, str) and "present" in s else 0
    )

    result: dict[int, dict] = {}
    for zone_id, grp in sensors.groupby("zone_number"):
        total = len(grp)
        occupied = int(grp["is_occupied"].sum())
        result[int(zone_id)] = {
            "occupied": occupied,
            "total": total,
            "pct": occupied / total if total > 0 else 0.0,
        }
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Event load per zone
# ─────────────────────────────────────────────────────────────────────────────
def _get_event_load_per_zone(
    at: datetime,
    zones: pd.DataFrame,
) -> dict[int, tuple[float, list[dict]]]:
    """Compute event load per zone at a given time.

    Returns {zone_number: (raw_event_load, [nearby_event_dicts])}.
    Event load = sum of gaussian(distance, sigma=300m) for active sessions.
    """
    if _event_sessions.empty:
        return {}

    at_aware = at if at.tzinfo else at.replace(tzinfo=MELB_TZ)
    at_naive = at_aware.replace(tzinfo=None)

    sess = _event_sessions.copy()
    sess["session_start"] = pd.to_datetime(sess["session_start"]).dt.tz_localize(None)
    sess["session_end"] = pd.to_datetime(sess["session_end"]).dt.tz_localize(None)

    active = sess[
        (sess["session_start"] <= at_naive) &
        (sess["session_end"].fillna(at_naive + timedelta(hours=3)) >= at_naive)
    ].copy()

    if active.empty:
        return {}

    result: dict[int, tuple[float, list[dict]]] = {}

    for _, z in zones.iterrows():
        zn = int(z["zone_number"])
        z_lat, z_lon = z["centroid_lat"], z["centroid_lon"]
        load = 0.0
        nearby_events: list[dict] = []

        for _, ev in active.iterrows():
            d = _haversine_m(z_lat, z_lon, ev["lat"], ev["lon"])
            if d > 1500:
                continue
            gauss = math.exp(-(d ** 2) / (2 * EVENT_DISTANCE_SIGMA_M ** 2))
            load += gauss
            if d <= 800:
                nearby_events.append({
                    "event_name": ev.get("event_name", ""),
                    "category": ev.get("category_name"),
                    "starts": str(ev.get("session_start", "")),
                    "ends": str(ev.get("session_end", "")),
                    "distance_m": int(d),
                })

        if load > 0 or nearby_events:
            result[zn] = (load, nearby_events)

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Pressure computation
# ─────────────────────────────────────────────────────────────────────────────
def _pct_rank(values: list[float]) -> list[float]:
    """Percentile rank each value in [0, 1]."""
    n = len(values)
    if n == 0:
        return []
    sorted_vals = sorted(enumerate(values), key=lambda x: x[1])
    ranks = [0.0] * n
    for rank_idx, (orig_idx, _) in enumerate(sorted_vals):
        ranks[orig_idx] = rank_idx / max(n - 1, 1)
    return ranks


def compute_pressure(
    at: Optional[datetime] = None,
    horizon: str = "now",
) -> list[dict]:
    """Compute pressure for all zones at a given time.

    Returns list of zone pressure dicts ready for API response.
    """
    if not _gold_loaded or _zone_bay_counts.empty:
        return []

    now_melb = datetime.now(MELB_TZ)
    if at is None:
        at = now_melb

    if isinstance(at, str):
        at = pd.to_datetime(at)
    if at.tzinfo is None:
        at = at.replace(tzinfo=MELB_TZ)

    dow = at.weekday()
    dow_type = "weekday" if dow < 5 else "weekend"
    hour = at.hour

    # 1) Live occupancy
    zone_occ = _get_zone_occupancy()

    # 2) Traffic z per zone
    tp_slice = _traffic_profile_zone[
        (_traffic_profile_zone["dow_type"] == dow_type) &
        (_traffic_profile_zone["hour"] == hour)
    ].set_index("zone_number")

    # 3) Event load
    event_loads = _get_event_load_per_zone(at, _zone_bay_counts)

    # Compute previous hour for trend
    at_prev = at - timedelta(hours=1)
    dow_prev = at_prev.weekday()
    dow_type_prev = "weekday" if dow_prev < 5 else "weekend"
    hour_prev = at_prev.hour
    tp_prev = _traffic_profile_zone[
        (_traffic_profile_zone["dow_type"] == dow_type_prev) &
        (_traffic_profile_zone["hour"] == hour_prev)
    ].set_index("zone_number")

    # Collect raw values for percentile ranking
    zones_list = _zone_bay_counts.to_dict("records")
    occ_values: list[float] = []
    traffic_values: list[float] = []
    event_values: list[float] = []

    for z in zones_list:
        zn = z["zone_number"]
        occ = zone_occ.get(zn, {}).get("pct", 0.5)
        occ_values.append(occ)

        tz = tp_slice.loc[zn]["traffic_z"] if zn in tp_slice.index else 0.0
        traffic_values.append(float(tz))

        ev_load = event_loads.get(zn, (0.0, []))[0]
        event_values.append(ev_load)

    # Percentile rank
    occ_ranks = _pct_rank(occ_values)
    traffic_ranks = _pct_rank(traffic_values)
    event_ranks = _pct_rank(event_values)

    results: list[dict] = []
    w = PRESSURE_WEIGHTS

    for i, z in enumerate(zones_list):
        zn = z["zone_number"]
        pressure = (
            w["occupancy"] * occ_ranks[i] +
            w["traffic"] * traffic_ranks[i] +
            w["events"] * event_ranks[i]
        )

        if pressure > 0.7:
            level = "high"
        elif pressure > 0.4:
            level = "medium"
        else:
            level = "low"

        # Trend: compare traffic z now vs previous hour
        tz_now = traffic_values[i]
        tz_prev = float(tp_prev.loc[zn]["traffic_z"]) if zn in tp_prev.index else tz_now
        occ_now = occ_values[i]
        delta = (tz_now - tz_prev) * 0.3 + occ_now * 0.1
        if delta > 0.05:
            trend = "rising"
        elif delta < -0.05:
            trend = "falling"
        else:
            trend = "stable"

        occ_info = zone_occ.get(zn, {"occupied": 0, "total": z["total_bays"], "pct": 0.0})
        ev_data = event_loads.get(zn, (0.0, []))

        results.append({
            "zone_id": zn,
            "label": z.get("zone_label", f"Zone {zn}"),
            "centroid_lat": z["centroid_lat"],
            "centroid_lon": z["centroid_lon"],
            "pressure": round(pressure, 3),
            "level": level,
            "trend": trend,
            "components": {
                "occupancy_pct": round(occ_info["pct"], 3),
                "traffic_z": round(traffic_values[i], 3),
                "event_load": round(event_values[i], 3),
            },
            "total_bays": z["total_bays"],
            "occupied_bays": occ_info["occupied"],
            "free_bays": occ_info["total"] - occ_info["occupied"],
            "events_nearby": ev_data[1][:5],
        })

    return results


# ─────────────────────────────────────────────────────────────────────────────
# Alternatives
# ─────────────────────────────────────────────────────────────────────────────
def find_alternatives(
    lat: float,
    lon: float,
    at: Optional[datetime] = None,
    radius_m: int = 800,
    limit: int = 3,
) -> dict:
    """Find lower-pressure zones near a destination point."""
    zones_pressure = compute_pressure(at=at)
    if not zones_pressure:
        return {"target_zone": None, "alternatives": []}

    # Find target zone (nearest to destination)
    target = min(
        zones_pressure,
        key=lambda z: _haversine_m(lat, lon, z["centroid_lat"], z["centroid_lon"]),
    )

    # Find alternatives: within radius, lower pressure, sorted by walk distance
    candidates: list[dict] = []
    for z in zones_pressure:
        if z["zone_id"] == target["zone_id"]:
            continue
        d = _haversine_m(lat, lon, z["centroid_lat"], z["centroid_lon"])
        walk_d = d * MANHATTAN_FACTOR
        if walk_d > radius_m:
            continue
        if z["pressure"] >= target["pressure"]:
            continue
        walk_min = max(1, int(walk_d / WALK_SPEED_M_PER_MIN))
        candidates.append({
            "zone_id": z["zone_id"],
            "label": z["label"],
            "pressure": z["pressure"],
            "level": z["level"],
            "free_bays": z["free_bays"],
            "walk_minutes": walk_min,
            "walk_distance_m": int(walk_d),
            "centroid_lat": z["centroid_lat"],
            "centroid_lon": z["centroid_lon"],
        })

    candidates.sort(key=lambda c: (c["pressure"], c["walk_distance_m"]))

    return {
        "target_zone": target,
        "alternatives": candidates[:limit],
    }
