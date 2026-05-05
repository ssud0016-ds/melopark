"""
forecasts.py
============
Epic 6 -- Predictive Parking Intelligence endpoints.

Endpoints:
  GET /api/forecasts/warnings           -- US 6.1 peak-time + event alerts
  GET /api/forecasts/pressure           -- predicted zone pressure at arrival time
  GET /api/forecasts/alternatives       -- US 6.2 lower-pressure zone recommendations
  GET /api/forecasts/events             -- event risk scores per zone

Acceptance criteria coverage (see Epic 6.0 spec):

  AC 6.1.1  /warnings?hours=6  -- returns zones with event_risk_level + events_nearby
             consumed by ParkingAlertBanner to trigger the 400m proximity alert

  AC 6.1.2  /warnings (same)   -- dismissKey built client-side from zone+event+level
             unique per condition change; re-alert fires automatically when key shifts

  AC 6.1.3  /warnings?hours=6  -- full 0-6h hourly slice; client scrubs via hour chips
             each entry has hours_from_now so the panel can filter per chip selection

  AC 6.2.1  /alternatives      -- composite score 0.70*(1-occ)+0.30*(1-dist_ratio)
             returns alternatives sorted descending by score, AC-compliant ranking

  AC 6.2.2  /alternatives      -- centroid_lat/lon in every alternative entry
             onZoneClick(zone) flyTo uses these coords (MapPage.jsx handles the call)

  AC 6.2.3  /alternatives      -- when no candidates: alternatives=[] (not omitted)
             ParkingForecastPanel renders "No quieter alternatives nearby" explicitly
"""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query

from app.services.forecast_service import (
    get_warnings,
    get_pressure_at,
    get_alternatives_for,
    get_event_risk,
)

router = APIRouter(prefix="/api/forecasts", tags=["forecasts"])

MELB_TZ = ZoneInfo("Australia/Melbourne")


def _parse_at(at: Optional[str]) -> Optional[datetime]:
    if not at:
        return None
    try:
        dt = datetime.fromisoformat(at)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=MELB_TZ)
        return dt
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=f"Invalid 'at' datetime: {exc}") from exc


# ─────────────────────────────────────────────────────────────────────────────
# US 6.1 – Peak-time and event warnings
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/warnings",
    summary="US 6.1 -- Peak-time and event warnings for the next N hours",
    description=(
        "Returns zone-level parking pressure warnings for the next `hours` hours "
        "(default 6). Each entry includes a warning level (low / moderate / high / "
        "critical), predicted occupancy, and event risk for that zone. Used to alert "
        "Liam before he leaves home.\n\n"
        "AC 6.1.1: entries with event_risk_level='medium'|'high' and non-null "
        "events_nearby are the event proximity triggers.\n\n"
        "AC 6.1.3: entries span hours_from_now 0–N, enabling the hour-chip timeline."
    ),
)
def get_forecast_warnings(
    hours: int = Query(
        6,
        ge=1,
        le=12,
        description="Hours ahead to forecast",
    ),
    at: Optional[str] = Query(
        None,
        description="ISO-8601 reference datetime (default: now Melbourne time)",
    ),
):
    query_time = _parse_at(at) or datetime.now(MELB_TZ)
    warnings = get_warnings(hours=hours, query_time=query_time)
    return {
        "generated_at": datetime.now(MELB_TZ).isoformat(),
        "query_time": query_time.isoformat(),
        "hours_ahead": hours,
        "warnings": warnings,
        "total": len(warnings),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Zone pressure at an arrival datetime
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/pressure",
    summary="Predicted zone pressure at a given arrival time",
    description=(
        "Returns predicted parking occupancy for all zones at the specified "
        "arrival time. Used by the planner panel so Liam can check pressure "
        "before leaving home."
    ),
)
def get_arrival_pressure(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Destination latitude"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Destination longitude"),
    at: Optional[str] = Query(
        None,
        description="ISO-8601 arrival datetime (default: now Melbourne time)",
    ),
):
    query_time = _parse_at(at) or datetime.now(MELB_TZ)
    zones = get_pressure_at(lat=lat, lon=lon, query_time=query_time)
    return {
        "generated_at": datetime.now(MELB_TZ).isoformat(),
        "query_time": query_time.isoformat(),
        "zones": zones,
    }


# ─────────────────────────────────────────────────────────────────────────────
# US 6.2 – Alternative area guidance
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/alternatives",
    summary="US 6.2 -- Find lower-pressure zones near a destination",
    description=(
        "When Liam's target zone is busy, returns up to `limit` nearby zones "
        "with better availability. Sorted by composite score: "
        "70% lower predicted occupancy + 30% proximity (AC 6.2.1).\n\n"
        "Each alternative includes centroid_lat/lon for map flyTo (AC 6.2.2).\n\n"
        "When no quieter alternatives exist within `radius` metres, "
        "`alternatives` is an empty array — never omitted — so the frontend "
        "can show 'No quieter alternatives nearby' (AC 6.2.3)."
    ),
)
def get_forecast_alternatives(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Destination latitude"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Destination longitude"),
    at: Optional[str] = Query(
        None,
        description="ISO-8601 arrival datetime (default: now Melbourne time)",
    ),
    radius: int = Query(
        800,
        ge=100,
        le=2000,
        description="Search radius in metres (default 800m)",
    ),
    limit: int = Query(
        3,
        ge=1,
        le=10,
        description="Max alternatives to return",
    ),
):
    query_time = _parse_at(at) or datetime.now(MELB_TZ)
    result = get_alternatives_for(
        lat=lat,
        lon=lon,
        query_time=query_time,
        radius_m=radius,
        limit=limit,
    )
    return {
        "generated_at": datetime.now(MELB_TZ).isoformat(),
        "query_time": query_time.isoformat(),
        "destination_lat": lat,
        "destination_lon": lon,
        "radius_m": radius,
        **result,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Event risk scores (supplementary for map overlay)
# ─────────────────────────────────────────────────────────────────────────────

@router.get(
    "/events",
    summary="Event risk scores per zone",
    description=(
        "Returns current event risk scores for all zones. "
        "Used by the map overlay to shade zones with upcoming events."
    ),
)
def get_forecast_events():
    risks = get_event_risk()
    return {
        "generated_at": datetime.now(MELB_TZ).isoformat(),
        "zones": risks,
        "total": len(risks),
    }
