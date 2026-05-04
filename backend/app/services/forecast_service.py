"""
forecast_service.py
===================
Service layer for Epic 6 Predictive Parking Intelligence.

Loads gold-layer parquets produced by scripts/build_parking_forecast.py
and serves:
  - Zone pressure predictions for a given arrival time
  - US 6.1 peak-time + event warnings (next 6 hours)
  - US 6.2 alternative zone recommendations

Data sources (all read from data/gold/):
  parking_forecast_model.joblib           -- trained XGBoost model
  parking_forecast_features.json          -- feature column order
  parking_pressure_profile.parquet        -- 25h zone pressure profile
  parking_peak_warnings_next_6h.parquet   -- US 6.1 warnings
  parking_alternative_guidance.parquet    -- US 6.2 alternatives
  parking_event_risk_scores.parquet       -- event risk per zone

If gold files are not present the endpoints return graceful fallbacks
so the rest of the app stays functional.

Run to regenerate gold files:
  python scripts/wrangle_epic6.py
  python scripts/build_parking_forecast.py
"""

from __future__ import annotations

import json
import logging
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional
from zoneinfo import ZoneInfo

import pandas as pd

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent.parent.parent
GOLD = ROOT / "data" / "gold"

MELB_TZ = ZoneInfo("Australia/Melbourne")

WALK_SPEED_M_PER_MIN = 83.3   # ~5 km/h
MANHATTAN_FACTOR = 1.4         # straight-line -> street-path multiplier


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Gold cache (loaded once at startup via load_forecast_data())
# ---------------------------------------------------------------------------

_pressure_profile: pd.DataFrame = pd.DataFrame()
_peak_warnings: pd.DataFrame = pd.DataFrame()
_alternatives_guidance: pd.DataFrame = pd.DataFrame()
_event_risk: pd.DataFrame = pd.DataFrame()
_model = None
_feature_cols: list[str] = []
_forecast_loaded: bool = False


def load_forecast_data() -> None:
    """
    Load all Epic 6 gold parquets into memory.
    Called once at FastAPI startup (lifespan).

    Non-fatal: if files are missing the flag stays False and all
    Epic 6 endpoints return empty/fallback responses.
    """
    global _pressure_profile, _peak_warnings, _alternatives_guidance
    global _event_risk, _model, _feature_cols, _forecast_loaded

    try:
        # Pressure profile (25h x 5 zones)
        p = GOLD / "parking_pressure_profile.parquet"
        if p.exists():
            _pressure_profile = pd.read_parquet(p)
            _pressure_profile["datetime_mel"] = pd.to_datetime(
                _pressure_profile["datetime_mel"], errors="coerce"
            )

        # US 6.1 warnings
        w = GOLD / "parking_peak_warnings_next_6h.parquet"
        if w.exists():
            _peak_warnings = pd.read_parquet(w)
            _peak_warnings["datetime_mel"] = pd.to_datetime(
                _peak_warnings["datetime_mel"], errors="coerce"
            )

        # US 6.2 alternatives
        a = GOLD / "parking_alternative_guidance.parquet"
        if a.exists():
            _alternatives_guidance = pd.read_parquet(a)

        # Event risk
        e = GOLD / "parking_event_risk_scores.parquet"
        if e.exists():
            _event_risk = pd.read_parquet(e)

        # XGBoost model (optional — for live re-scoring at request time)
        mp = GOLD / "parking_forecast_model.joblib"
        fp = GOLD / "parking_forecast_features.json"
        if mp.exists() and fp.exists():
            import joblib
            _model = joblib.load(mp)
            _feature_cols = json.loads(fp.read_text())
            logger.info("Epic 6 XGBoost model loaded (%d features)", len(_feature_cols))

        _forecast_loaded = (
            not _pressure_profile.empty
            or not _peak_warnings.empty
        )

        logger.info(
            "Epic 6 gold loaded: pressure=%d rows, warnings=%d rows, "
            "alternatives=%d rows, event_risk=%d rows",
            len(_pressure_profile), len(_peak_warnings),
            len(_alternatives_guidance), len(_event_risk),
        )

    except Exception as exc:
        logger.warning(
            "Epic 6 gold data not fully loaded: %s -- "
            "forecast endpoints will use pattern fallback",
            exc,
        )
        _forecast_loaded = False


def is_forecast_loaded() -> bool:
    return _forecast_loaded


# ---------------------------------------------------------------------------
# Pattern-based fallback predictor (used when model is not available)
# ---------------------------------------------------------------------------

def _pattern_predict(hour: int, dow: int) -> float:
    """
    Simple time-of-day demand pattern used as fallback when the XGBoost
    model or gold parquets are not available.

    Returns a normalised demand value in [0, 1].
    """
    if dow < 5:  # weekday
        return min(1.0, max(0.0,
            0.25
            + 0.55 * math.exp(-((hour - 8.5) ** 2) / 2)
            + 0.30 * math.exp(-((hour - 12.5) ** 2) / 2)
            + 0.45 * math.exp(-((hour - 17.5) ** 2) / 2)
        ))
    else:  # weekend
        return min(1.0, max(0.0,
            0.10
            + 0.25 * math.exp(-((hour - 11) ** 2) / 4)
            + 0.40 * math.exp(-((hour - 19) ** 2) / 4)
        ))


def _level_from_score(score: float) -> str:
    if score > 0.75:
        return "high"
    if score > 0.45:
        return "medium"
    return "low"


def _warning_level_from_score(score: float) -> str:
    if score > 0.80:
        return "critical"
    if score > 0.65:
        return "high"
    if score > 0.45:
        return "moderate"
    return "low"


# ---------------------------------------------------------------------------
# US 6.1 -- Peak-time and event warnings
# ---------------------------------------------------------------------------

_ZONE_LABELS = [
    "CBD North", "CBD Central", "CBD South", "Docklands", "Southbank",
]

_ZONE_CENTRES = {
    "CBD North":   (-37.8065, 144.9650),
    "CBD Central": (-37.8115, 144.9650),
    "CBD South":   (-37.8170, 144.9650),
    "Docklands":   (-37.8150, 144.9465),
    "Southbank":   (-37.8230, 144.9650),
}


def get_warnings(hours_ahead: int = 6) -> list[dict]:
    """
    US 6.1 -- Return peak-time + event warnings for the next N hours.

    Data source priority:
      1. Gold parquet (parking_peak_warnings_next_6h.parquet) -- most accurate,
         built by build_parking_forecast.py using real SCATS data
      2. Pattern fallback -- if gold not loaded

    Returns one entry per zone per hour, deduplicated to highest warning
    level per zone if multiple hours have the same level.
    """
    now_melb = datetime.now(MELB_TZ)

    # -- Gold parquet path --
    if not _peak_warnings.empty:
        cutoff = now_melb + timedelta(hours=hours_ahead)
        df = _peak_warnings.copy()

        # Filter to the requested window
        if "datetime_mel" in df.columns and df["datetime_mel"].notna().any():
            df = df[df["datetime_mel"] <= cutoff].copy()
        elif "hours_from_now" in df.columns:
            df = df[df["hours_from_now"] <= hours_ahead].copy()

        if not df.empty:
            # Merge event risk into warnings
            event_by_zone: dict[str, dict] = {}
            if not _event_risk.empty:
                for _, row in _event_risk.iterrows():
                    event_by_zone[str(row["zone"])] = {
                        "risk_level":    row.get("risk_level", "LOW"),
                        "risk_score":    float(row.get("risk_score", 0)),
                        "events_nearby": str(row.get("events_nearby", "None")),
                    }

            results = []
            for _, row in df.iterrows():
                zone_name = str(row.get("zone", ""))
                ev = event_by_zone.get(zone_name, {})
                centre = _ZONE_CENTRES.get(zone_name, (-37.8136, 144.9631))
                results.append({
                    "zone":                zone_name,
                    "hours_from_now":      int(row.get("hours_from_now", 0)),
                    "datetime_mel":        str(row.get("datetime_mel", "")),
                    "predicted_occupancy": round(float(row.get("predicted_occupancy", 0)), 3),
                    "warning_level":       str(row.get("warning_level", "LOW")).lower(),
                    "warning_message":     str(row.get("warning_message", "")),
                    "event_risk_level":    ev.get("risk_level", "LOW").lower(),
                    "event_risk_score":    ev.get("risk_score", 0),
                    "events_nearby":       ev.get("events_nearby", "None"),
                    "zone_lat":            float(row.get("zone_lat", centre[0])),
                    "zone_lon":            float(row.get("zone_lon", centre[1])),
                })
            return results

    # -- Pattern fallback --
    results = []
    for h in range(hours_ahead):
        ts = now_melb + timedelta(hours=h)
        score = _pattern_predict(ts.hour, ts.weekday())
        level = _warning_level_from_score(score)
        for zone, centre in _ZONE_CENTRES.items():
            results.append({
                "zone":                zone,
                "hours_from_now":      h,
                "datetime_mel":        ts.isoformat(),
                "predicted_occupancy": round(score, 3),
                "warning_level":       level,
                "warning_message":     (
                    f"{zone}: {'Very high' if level == 'critical' else level.capitalize()} "
                    f"demand expected."
                ),
                "event_risk_level":    "low",
                "event_risk_score":    0.0,
                "events_nearby":       "None",
                "zone_lat":            centre[0],
                "zone_lon":            centre[1],
            })
    return results


def get_pressure_at(at: Optional[datetime] = None) -> list[dict]:
    """
    Return zone pressure for a specific arrival datetime.

    Used by the planner: driver sets arrival time, gets predicted pressure.

    Data source priority:
      1. Gold pressure profile (parking_pressure_profile.parquet)
      2. Live XGBoost model re-score at request time
      3. Pattern fallback
    """
    if at is None:
        at = datetime.now(MELB_TZ)
    if at.tzinfo is None:
        at = at.replace(tzinfo=MELB_TZ)

    # -- Gold profile path --
    if not _pressure_profile.empty and "hour" in _pressure_profile.columns:
        # Find closest hour in profile
        df = _pressure_profile[_pressure_profile["hour"] == at.hour].copy()
        if not df.empty:
            results = []
            for _, row in df.iterrows():
                zone = str(row.get("zone", ""))
                centre = _ZONE_CENTRES.get(zone, (-37.8136, 144.9631))
                score = float(row.get("predicted_occ", 0))
                results.append({
                    "zone":           zone,
                    "predicted_occ":  round(score, 3),
                    "pressure_level": _level_from_score(score),
                    "trend":          str(row.get("pressure_status", "")).lower(),
                    "zone_lat":       float(row.get("zone_lat", centre[0])),
                    "zone_lon":       float(row.get("zone_lon", centre[1])),
                    "source":         "gold_profile",
                })
            return results

    # -- Pattern fallback --
    results = []
    for zone, centre in _ZONE_CENTRES.items():
        score = _pattern_predict(at.hour, at.weekday())
        results.append({
            "zone":           zone,
            "predicted_occ":  round(score, 3),
            "pressure_level": _level_from_score(score),
            "trend":          "stable",
            "zone_lat":       centre[0],
            "zone_lon":       centre[1],
            "source":         "pattern_fallback",
        })
    return results


# ---------------------------------------------------------------------------
# US 6.2 -- Alternative zone recommendations
# ---------------------------------------------------------------------------

def get_alternatives_for(
    lat: float,
    lon: float,
    at: Optional[datetime] = None,
    radius_m: int = 1500,
    limit: int = 3,
) -> dict:
    """
    US 6.2 -- Find lower-pressure zones near a destination.

    Score = 0.7 * (1 - predicted_occupancy) + 0.3 * (1 - distance_ratio)

    Data source: parking_alternative_guidance.parquet (gold) if available,
    else derived live from get_pressure_at().
    """
    if at is None:
        at = datetime.now(MELB_TZ)
    if at.tzinfo is None:
        at = at.replace(tzinfo=MELB_TZ)

    # Identify the target zone (nearest zone centre to destination)
    zones_pressure = get_pressure_at(at)
    if not zones_pressure:
        return {"target_zone": None, "alternatives": [], "at": at.isoformat()}

    target = min(
        zones_pressure,
        key=lambda z: _haversine_m(lat, lon, z["zone_lat"], z["zone_lon"]),
    )
    target_dist = _haversine_m(lat, lon, target["zone_lat"], target["zone_lon"])

    # -- Gold alternatives path --
    if not _alternatives_guidance.empty and "hours_from_now" in _alternatives_guidance.columns:
        hours_ahead = max(0, round((at - datetime.now(MELB_TZ)).total_seconds() / 3600))
        df = _alternatives_guidance[
            _alternatives_guidance["hours_from_now"] == min(hours_ahead, 6)
        ].copy()

        if not df.empty and "congested_zone" in df.columns:
            # Filter to rows about the target zone
            target_rows = df[df["congested_zone"] == target["zone"]]
            if not target_rows.empty:
                alts = []
                for _, row in target_rows.head(limit).iterrows():
                    alt_zone = str(row.get("alternative_zone", ""))
                    alt_centre = _ZONE_CENTRES.get(alt_zone, (-37.8136, 144.9631))
                    d = _haversine_m(lat, lon, alt_centre[0], alt_centre[1])
                    walk_d = d * MANHATTAN_FACTOR
                    alts.append({
                        "zone":              alt_zone,
                        "predicted_occ":     round(float(row.get("alt_predicted_occupancy", 0)), 3),
                        "pressure_level":    str(row.get("alt_warning_level", "low")).lower(),
                        "walk_minutes":      int(row.get("alt_walk_mins", max(1, int(walk_d / WALK_SPEED_M_PER_MIN)))),
                        "walk_distance_m":   int(walk_d),
                        "recommendation":    str(row.get("recommendation", "")),
                        "zone_lat":          float(row.get("alt_zone_lat", alt_centre[0])),
                        "zone_lon":          float(row.get("alt_zone_lon", alt_centre[1])),
                    })
                return {
                    "target_zone":  target,
                    "alternatives": alts,
                    "at":           at.isoformat(),
                    "source":       "gold_guidance",
                }

    # -- Live derivation from pressure --
    candidates = []
    for z in zones_pressure:
        if z["zone"] == target["zone"]:
            continue
        d = _haversine_m(lat, lon, z["zone_lat"], z["zone_lon"])
        walk_d = d * MANHATTAN_FACTOR
        if walk_d > radius_m:
            continue
        if z["predicted_occ"] >= target["predicted_occ"]:
            continue
        walk_min = max(1, int(walk_d / WALK_SPEED_M_PER_MIN))
        dist_ratio = walk_d / max(radius_m, 1)
        score = 0.7 * (1 - z["predicted_occ"]) + 0.3 * (1 - dist_ratio)
        candidates.append({
            "zone":              z["zone"],
            "predicted_occ":     z["predicted_occ"],
            "pressure_level":    z["pressure_level"],
            "walk_minutes":      walk_min,
            "walk_distance_m":   int(walk_d),
            "recommendation": (
                f"Try {z['zone']} -- "
                f"{int(z['predicted_occ'] * 100)}% predicted busy, "
                f"~{walk_min} min walk."
            ),
            "zone_lat":          z["zone_lat"],
            "zone_lon":          z["zone_lon"],
            "_score":            score,
        })

    candidates.sort(key=lambda c: -c.pop("_score"))

    return {
        "target_zone":  target,
        "alternatives": candidates[:limit],
        "at":           at.isoformat(),
        "source":       "live_derived",
    }


def get_event_risk() -> list[dict]:
    """Return event risk scores per zone (from gold parquet or empty list)."""
    if _event_risk.empty:
        return []
    return [
        {
            "zone":          str(row.get("zone", "")),
            "event_count":   int(row.get("event_count", 0)),
            "risk_score":    round(float(row.get("risk_score", 0)), 3),
            "risk_level":    str(row.get("risk_level", "LOW")).lower(),
            "events_nearby": str(row.get("events_nearby", "None")),
            "zone_lat":      float(row.get("zone_lat", -37.8136)),
            "zone_lon":      float(row.get("zone_lon", 144.9631)),
        }
        for _, row in _event_risk.iterrows()
    ]
