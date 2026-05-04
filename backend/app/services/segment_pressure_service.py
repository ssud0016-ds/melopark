"""Segment-level parking pressure for vector-tile overlay.

Reuses the same blend as `pressure_service.compute_pressure` (occupancy 0.55 +
SCATS traffic_z 0.30 + event_load 0.15, percentile-ranked) but scoped to
road segments instead of zones.

Inputs:
- data/gold/epic5_segment_pressure_static.parquet  (geometry, total_bays, scats_site_no, zone_numbers)
- data/silver/sensors_clean.parquet                (sensor → roadsegmentid via lookup)
- data/silver/epic5_traffic_site_hourly.parquet    (SCATS volumes; for traffic_z fallback)
- data/gold/epic5_traffic_profile_zone.parquet     (zone-level traffic_z)
- data/gold/epic5_event_sessions_gold.parquet      (event sessions)

Output: list of dicts with segment_id, line geometry (shapely LineString),
        pressure, level, trend, free_bays, total_bays, events_nearby, signals.
"""

from __future__ import annotations

import logging
import math
import hashlib
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

import pandas as pd
from shapely.wkb import loads as wkb_loads

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent.parent.parent
GOLD = ROOT / "data" / "gold"
SILVER = ROOT / "data" / "silver"
DATA = ROOT / "data"

MELB_TZ = ZoneInfo("Australia/Melbourne")

WEIGHTS = {"occupancy": 0.55, "traffic": 0.30, "events": 0.15}
EVENT_DISTANCE_SIGMA_M = 300
EVENT_POPUP_RADIUS_M = 1500
EVENT_POPUP_MAX = 3

_segments_df: pd.DataFrame = pd.DataFrame()
_segment_geom: dict[str, object] = {}
_sensor_to_segment: dict[str, str] = {}
_loaded: bool = False

# Cached gold reads (avoid re-read parquet on every pressure compute / manifest poll).
_traffic_profile_raw_df: Optional[pd.DataFrame] = None
_traffic_z_out_cache: dict[tuple[bool, int], dict[str, float]] = {}
_events_sessions_df_cache: Optional[pd.DataFrame] = None


def is_segment_in_pressure_scope(row) -> bool:
    """True when a segment belongs to parking-zone data and has live bays."""
    zones = row.get("zone_numbers", []) if hasattr(row, "get") else []
    if zones is None:
        return False
    total_bays = row.get("total_bays", 0) if hasattr(row, "get") else 0
    try:
        return len(zones) > 0 and int(total_bays) > 0
    except (TypeError, ValueError):
        return False


def get_pressure_scope_df() -> pd.DataFrame:
    """Static segment rows eligible for Busy Now pressure rendering."""
    if _segments_df.empty:
        return _segments_df
    return _segments_df[_segments_df.apply(is_segment_in_pressure_scope, axis=1)]


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def load_segment_data() -> None:
    global _segments_df, _segment_geom, _sensor_to_segment, _loaded
    static_path = GOLD / "epic5_segment_pressure_static.parquet"
    if not static_path.exists():
        logger.warning("Segment static parquet missing: %s — segments disabled", static_path)
        _loaded = False
        return

    df = pd.read_parquet(static_path)
    df["segment_id"] = df["segment_id"].astype(str)
    _segments_df = df
    _segment_geom = {
        row["segment_id"]: wkb_loads(row["geometry_wkb"])
        for _, row in df.iterrows()
    }

    lookup_path = DATA / "sensor_to_segment_lookup.csv"
    if lookup_path.exists():
        lk = pd.read_csv(lookup_path)
        _sensor_to_segment = {
            str(r["_sensor_norm"]): str(r["roadsegmentid"])
            for _, r in lk.iterrows()
        }
    else:
        _sensor_to_segment = {}

    _loaded = True
    logger.info(
        "Segment data loaded: %d segments, %d sensor→segment links",
        len(df), len(_sensor_to_segment),
    )


def is_loaded() -> bool:
    return _loaded


def get_segments_df() -> pd.DataFrame:
    return _segments_df


def get_segment_geom() -> dict[str, object]:
    return _segment_geom


def _segment_occupancy() -> dict[str, dict]:
    """Live sensor → segment aggregation. {seg_id: {occupied, total, pct}}."""
    from app.services.parking_service import _sensor_cache

    if not _sensor_to_segment or not _sensor_cache:
        return {}

    counts: dict[str, dict] = {}
    for rec in _sensor_cache:
        bay_id = rec.get("bay_id") or rec.get("kerbsideid")
        if not bay_id:
            continue
        seg = _sensor_to_segment.get(str(bay_id))
        if not seg:
            continue
        slot = counts.setdefault(seg, {"occupied": 0, "total": 0})
        slot["total"] += 1
        status = (rec.get("status") or rec.get("status_description", "") or "").lower()
        if "present" in status:
            slot["occupied"] += 1

    for seg, c in counts.items():
        c["pct"] = c["occupied"] / c["total"] if c["total"] > 0 else 0.0
    return counts


def _segment_traffic_z(at: datetime) -> dict[str, float]:
    """Traffic z per segment via zone_numbers (zone-level profile is available)."""
    global _traffic_profile_raw_df
    cache_key = (at.weekday() < 5, at.hour)
    if cache_key in _traffic_z_out_cache:
        return _traffic_z_out_cache[cache_key]

    profile_path = GOLD / "epic5_traffic_profile_zone.parquet"
    if not profile_path.exists():
        _traffic_z_out_cache[cache_key] = {}
        return {}

    if _traffic_profile_raw_df is None:
        _traffic_profile_raw_df = pd.read_parquet(profile_path)

    tp = _traffic_profile_raw_df
    dow_type = "weekday" if at.weekday() < 5 else "weekend"
    slice_ = tp[(tp["dow_type"] == dow_type) & (tp["hour"] == at.hour)]
    zone_z = dict(zip(slice_["zone_number"].astype(int), slice_["traffic_z"]))

    out: dict[str, float] = {}
    for _, row in _segments_df.iterrows():
        zones = row["zone_numbers"]
        if zones is None or len(zones) == 0:
            continue
        vals = [zone_z.get(int(z), 0.0) for z in zones]
        out[row["segment_id"]] = float(sum(vals) / len(vals)) if vals else 0.0
    _traffic_z_out_cache[cache_key] = out
    return out


def _events_sessions_df() -> pd.DataFrame:
    """Load event sessions gold once; filter per query in _active_events."""
    global _events_sessions_df_cache
    if _events_sessions_df_cache is not None:
        return _events_sessions_df_cache

    es_path = GOLD / "epic5_event_sessions_gold.parquet"
    if not es_path.exists():
        _events_sessions_df_cache = pd.DataFrame()
        return _events_sessions_df_cache

    df = pd.read_parquet(es_path)
    if df.empty:
        _events_sessions_df_cache = df
        return _events_sessions_df_cache

    df = df.copy()
    df["session_start"] = pd.to_datetime(df["session_start"]).dt.tz_localize(None)
    df["session_end"] = pd.to_datetime(df["session_end"]).dt.tz_localize(None)
    _events_sessions_df_cache = df
    return _events_sessions_df_cache


def _active_events(at: datetime) -> pd.DataFrame:
    df = _events_sessions_df()
    if df.empty:
        return df
    at_naive = at.replace(tzinfo=None) if at.tzinfo else at
    return df[
        (df["session_start"] <= at_naive)
        & (df["session_end"].fillna(at_naive + timedelta(hours=3)) >= at_naive)
    ].copy()


def _segment_event_load(active: pd.DataFrame) -> dict[str, tuple[float, list[dict]]]:
    if active.empty:
        return {}
    out: dict[str, tuple[float, list[dict]]] = {}
    for _, row in _segments_df.iterrows():
        mid_lat = float(row["mid_lat"])
        mid_lon = float(row["mid_lon"])
        load = 0.0
        nearby: list[dict] = []
        for _, ev in active.iterrows():
            d = _haversine_m(mid_lat, mid_lon, float(ev["lat"]), float(ev["lon"]))
            if d > 1500:
                continue
            gauss = math.exp(-(d ** 2) / (2 * EVENT_DISTANCE_SIGMA_M ** 2))
            load += gauss
            if d <= 800:
                nearby.append({
                    "event_name": ev.get("event_name", ""),
                    "category": ev.get("category_name"),
                    "distance_m": int(d),
                    "start_iso": _session_start_iso(ev.get("session_start")),
                })
        if load > 0 or nearby:
            out[row["segment_id"]] = (load, nearby[:3])
    return out


def _pct_rank(values: list[float]) -> list[float]:
    n = len(values)
    if n == 0:
        return []
    sorted_idx = sorted(range(n), key=lambda i: values[i])
    ranks = [0.0] * n
    for rank_idx, orig_idx in enumerate(sorted_idx):
        ranks[orig_idx] = rank_idx / max(n - 1, 1)
    return ranks


def _count_active_event_segments(rows: list[dict], now_melb: datetime) -> int:
    """Segments with ≥1 nearby event whose session has started (same rule as tile manifest)."""
    n = 0
    for r in rows:
        nearby = r.get("events_nearby")
        if not nearby or not isinstance(nearby, list):
            continue
        for e in nearby:
            iso = e.get("start_iso")
            if not iso:
                continue
            try:
                ev_dt = datetime.fromisoformat(iso)
            except (ValueError, TypeError):
                continue
            if ev_dt.tzinfo is None:
                ev_dt = ev_dt.replace(tzinfo=MELB_TZ)
            if ev_dt <= now_melb:
                n += 1
                break
    return n


def compute_segment_pressure(at: Optional[datetime] = None) -> tuple[list[dict], int]:
    if not _loaded or _segments_df.empty:
        return [], 0

    now_melb = datetime.now(MELB_TZ)
    at = at or now_melb
    if at.tzinfo is None:
        at = at.replace(tzinfo=MELB_TZ)

    occ = _segment_occupancy()
    traffic_z = _segment_traffic_z(at)
    active = _active_events(at)
    event_load = _segment_event_load(active)

    at_prev = at - timedelta(hours=1)
    traffic_z_prev = _segment_traffic_z(at_prev)

    scope_df = get_pressure_scope_df()
    seg_ids = scope_df["segment_id"].tolist()
    occ_vals = [occ.get(s, {}).get("pct", 0.0) for s in seg_ids]
    traffic_vals = [traffic_z.get(s, 0.0) for s in seg_ids]
    event_vals = [event_load.get(s, (0.0, []))[0] for s in seg_ids]

    occ_r = _pct_rank(occ_vals)
    traffic_r = _pct_rank(traffic_vals)
    event_r = _pct_rank(event_vals)
    w = WEIGHTS

    out: list[dict] = []
    for i, seg in enumerate(seg_ids):
        # has_signal: any of occupancy(total>0), traffic, event
        row = scope_df.iloc[i]
        total_bays = int(row["total_bays"])
        has_traffic = seg in traffic_z
        has_event = seg in event_load
        occ_info = occ.get(seg, {"occupied": 0, "total": 0})
        sampled_bays = int(occ_info.get("total", 0))
        has_live_bays = sampled_bays > 0
        has_signal = has_live_bays or has_traffic or has_event

        if not has_signal:
            level = "unknown"
            pressure = None
            trend = "flat"
        else:
            pressure = (
                w["occupancy"] * occ_r[i]
                + w["traffic"] * traffic_r[i]
                + w["events"] * event_r[i]
            )
            level = "high" if pressure > 0.7 else "medium" if pressure > 0.4 else "low"
            tz_now = traffic_vals[i]
            tz_prev = traffic_z_prev.get(seg, tz_now)
            occ_now = occ_vals[i]
            delta = (tz_now - tz_prev) * 0.3 + occ_now * 0.1
            trend = "up" if delta > 0.05 else "down" if delta < -0.05 else "flat"

        ev_info = event_load.get(seg, (0.0, []))

        out.append({
            "segment_id": seg,
            "street_name": row["street_name"],
            "seg_descr": row["seg_descr"],
            "pressure": round(pressure, 3) if pressure is not None else None,
            "level": level,
            "trend": trend,
            "total_bays": total_bays,
            "occupied_bays": occ_info["occupied"],
            "free_bays": max(0, occ_info["total"] - occ_info["occupied"]),
            "sampled_bays": sampled_bays,
            "has_live_bays": has_live_bays,
            "events_nearby": ev_info[1] if ev_info else [],
            "components": {
                "occupancy_pct": round(occ_vals[i], 3),
                "traffic_z": round(traffic_vals[i], 3),
                "event_load": round(event_vals[i], 3),
            },
        })
    active_event_segment_count = _count_active_event_segments(out, now_melb)
    return out, active_event_segment_count


# Module-level cache: data_version key → (rows, manifest active-event segment count)
_pressure_cache: dict[str, tuple[list[dict], int]] = {}
_pressure_cache_max = 8


def _sensor_source_signature() -> str:
    """Stable signature for live bay source data, avoiding wall-clock tile churn."""
    from app.services.parking_service import _sensor_cache

    if not _sensor_cache:
        return "sensors-empty"

    latest = ""
    for rec in _sensor_cache:
        raw = rec.get("lastupdated") or rec.get("last_updated") or ""
        if raw and str(raw) > latest:
            latest = str(raw)
    return f"sensors-{len(_sensor_cache)}-{latest or 'unknown'}"


def get_pressure_data_version(at: Optional[datetime] = None) -> str:
    """Version changes when source data/time bucket can change pressure output."""
    at_eff = at or datetime.now(MELB_TZ)
    if at_eff.tzinfo is None:
        at_eff = at_eff.replace(tzinfo=MELB_TZ)
    # Traffic changes hourly; event activity is coarse enough at 5-minute buckets.
    event_bucket_min = (at_eff.minute // 5) * 5
    basis = "|".join([
        _sensor_source_signature(),
        at_eff.strftime("%Y-%m-%dT%H"),
        f"event-{event_bucket_min:02d}",
    ])
    return hashlib.sha1(basis.encode("utf-8")).hexdigest()[:16]


def get_pressure_by_data_version(at: Optional[datetime] = None) -> tuple[str, list[dict], int]:
    """Return (data_version, pressure_rows, active_event_segment_count). Cached until version changes."""
    at_eff = (at or datetime.now(MELB_TZ)).replace(second=0, microsecond=0)
    key = get_pressure_data_version(at_eff)
    if key not in _pressure_cache:
        if len(_pressure_cache) >= _pressure_cache_max:
            _pressure_cache.pop(next(iter(_pressure_cache)))
        rows, active_count = compute_segment_pressure(at_eff)
        _pressure_cache[key] = (rows, active_count)
    cached = _pressure_cache[key]
    return key, cached[0], cached[1]


def get_pressure_by_minute(at: Optional[datetime] = None) -> tuple[str, list[dict], int]:
    """Backward-compatible alias for pressure data-version cache."""
    return get_pressure_by_data_version(at)


def get_segment_detail(seg_id: str) -> Optional[dict]:
    """Return a single segment's pressure dict, or None."""
    _, rows, _ = get_pressure_by_minute()
    for r in rows:
        if r["segment_id"] == str(seg_id):
            return r
    return None


def _session_start_iso(val) -> str:
    if val is None:
        return ""
    try:
        if pd.isna(val):
            return ""
    except (TypeError, ValueError):
        pass
    if hasattr(val, "isoformat"):
        try:
            return val.isoformat()
        except (ValueError, OSError):
            return str(val)
    return str(val)


def build_segment_public_detail(seg_id: str) -> Optional[dict]:
    """API shape for GET /segments/{id}: occ_pct, events with name/start_iso/distance_m (top 3 ≤1.5 km)."""
    base = get_segment_detail(seg_id)
    if not base:
        return None
    sid = str(seg_id)
    row_match = _segments_df[_segments_df["segment_id"] == sid]
    if row_match.empty:
        return None
    mid_lat = float(row_match.iloc[0]["mid_lat"])
    mid_lon = float(row_match.iloc[0]["mid_lon"])

    at = datetime.now(MELB_TZ)
    active = _active_events(at)
    events_out: list[dict] = []
    if not active.empty:
        for _, ev in active.iterrows():
            d = _haversine_m(mid_lat, mid_lon, float(ev["lat"]), float(ev["lon"]))
            if d > EVENT_POPUP_RADIUS_M:
                continue
            events_out.append({
                "name": str(ev.get("event_name", "") or ""),
                "start_iso": _session_start_iso(ev.get("session_start")),
                "distance_m": int(d),
            })
        events_out.sort(key=lambda x: x["distance_m"])
        events_out = events_out[:EVENT_POPUP_MAX]

    sensor_total = int(base["occupied_bays"]) + int(base["free_bays"])
    occ_pct: Optional[int]
    if sensor_total > 0:
        occ_pct = int(round(100.0 * int(base["occupied_bays"]) / sensor_total))
    else:
        occ_pct = None

    return {
        "segment_id": base["segment_id"],
        "street_name": base["street_name"],
        "seg_descr": base.get("seg_descr"),
        "occ_pct": occ_pct,
        "free": int(base["free_bays"]),
        "total": int(base["total_bays"]),
        "sampled_bays": int(base.get("sampled_bays", 0)),
        "has_live_bays": bool(base.get("has_live_bays", False)),
        "trend": base["trend"],
        "pressure": base["pressure"],
        "level": base["level"],
        "events": events_out,
    }
