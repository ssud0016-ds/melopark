"""
forecasts.py
============
Epic 6 -- Predictive Parking Intelligence endpoints.

Endpoints:
  GET /api/forecasts/warnings           -- US 6.1 peak-time + event alerts
  GET /api/forecasts/pressure           -- predicted zone pressure at arrival time
  GET /api/forecasts/alternatives       -- US 6.2 lower-pressure zone recommendations
  GET /api/forecasts/events             -- event risk scores per zone
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query, Request

from app.services.forecast_service import (
    get_warnings,
    get_pressure_at,
    get_alternatives_for,
    get_event_risk,
    is_forecast_loaded,
)

router = APIRouter(prefix="/api/forecasts", tags=["forecasts"])

MELB_TZ = ZoneInfo("Australia/Melbourne")


def _parse_at(at: Optional[str]) -> Optional[datetime]:
    """Parse ISO-8601 arrival datetime. Attaches Melbourne tz if naive."""
    if not at:
        return None
    try:
        dt = datetime.fromisoformat(at)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=MELB_TZ)
        return dt
    except (ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid 'at' datetime: {exc}. Expected ISO-8601 e.g. 2026-05-01T09:00:00",
        ) from exc


@router.get(
    "/warnings",
    summary="US 6.1 -- Peak-time and event warnings for the next N hours",
    description=(
        "Returns zone-level parking pressure warnings for the next `hours` hours "
        "(default 6). Each entry includes a warning level (low / moderate / high / critical), "
        "predicted occupancy, and event risk for that zone. "
        "Used to alert Liam before he leaves home."
    ),
)
def get_forecast_warnings(
    request: Request,
    hours: int = Query(6, ge=1, le=12, description="Hours ahead to forecast"),
):
    """
    US 6.1 -- Event and Peak-Time Warnings.

    Reads parking_peak_warnings_next_6h.parquet (built by build_parking_forecast.py).
    Falls back to a time-of-day pattern if gold data is not available.
    """
    warnings = get_warnings(hours_ahead=hours)
    return {
        "generated_at": datetime.now(MELB_TZ).isoformat(),
        "hours_ahead":  hours,
        "data_source":  "gold_xgboost" if is_forecast_loaded() else "pattern_fallback",
        "warnings":     warnings,
    }


@router.get(
    "/pressure",
    summary="Predicted zone pressure at a given arrival time",
    description=(
        "Returns predicted parking pressure per zone at the specified arrival datetime "
        "(default: now). Allows the driver to see how busy zones will be when they arrive, "
        "not just right now."
    ),
)
def get_forecast_pressure(
    request: Request,
    at: Optional[str] = Query(
        None,
        description="ISO-8601 arrival datetime. Default: now (Melbourne time).",
    ),
):
    """
    Returns zone pressure predictions for a given arrival time.

    Reads parking_pressure_profile.parquet (25h rolling profile).
    Falls back to pattern prediction if gold not available.
    """
    arrival = _parse_at(at) or datetime.now(MELB_TZ)
    zones = get_pressure_at(at=arrival)
    return {
        "generated_at": datetime.now(MELB_TZ).isoformat(),
        "arrival_at":   arrival.isoformat(),
        "data_source":  "gold_profile" if is_forecast_loaded() else "pattern_fallback",
        "zones":        zones,
    }


@router.get(
    "/alternatives",
    summary="US 6.2 -- Recommended lower-pressure zones near a destination",
    description=(
        "Given a destination lat/lon and optional arrival time, returns the target zone "
        "pressure and up to `limit` recommended alternative zones that are less busy "
        "and within walking distance. Each alternative includes predicted occupancy, "
        "walk time, and a plain-English recommendation."
    ),
)
def get_forecast_alternatives(
    request: Request,
    lat: float = Query(..., ge=-90.0, le=90.0, description="Destination latitude"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Destination longitude"),
    at: Optional[str] = Query(
        None,
        description="ISO-8601 arrival datetime. Default: now.",
    ),
    radius: int = Query(
        1500,
        ge=100,
        le=3000,
        description="Search radius in metres for alternatives",
    ),
    limit: int = Query(3, ge=1, le=5, description="Max alternatives to return"),
):
    """
    US 6.2 -- Alternative Area Guidance.

    Reads parking_alternative_guidance.parquet when available.
    Falls back to live derivation from pressure profile.
    """
    arrival = _parse_at(at)
    result = get_alternatives_for(
        lat=lat,
        lon=lon,
        at=arrival,
        radius_m=radius,
        limit=limit,
    )
    result["generated_at"] = datetime.now(MELB_TZ).isoformat()
    return result


@router.get(
    "/events",
    summary="Event risk scores per zone (next 48 hours)",
    description=(
        "Returns event-based risk scores for each zone based on upcoming events "
        "within 2km of each zone centre. Risk levels: low / medium / high."
    ),
)
def get_forecast_events(request: Request):
    """
    Event risk per zone from parking_event_risk_scores.parquet.
    Returns empty list if no gold data is available.
    """
    return {
        "generated_at": datetime.now(MELB_TZ).isoformat(),
        "event_risks":  get_event_risk(),
    }
