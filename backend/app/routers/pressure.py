"""Epic 5 parking pressure endpoints."""

from __future__ import annotations

from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query, Request

from app.schemas.pressure import (
    AlternativesResponse,
    PressureResponse,
    DataSourceStatus,
)
from app.services.pressure_service import (
    compute_pressure,
    find_alternatives,
    get_zone_hulls_geojson,
    is_gold_loaded,
)

router = APIRouter(prefix="/api/pressure", tags=["pressure"])

MELB_TZ = ZoneInfo("Australia/Melbourne")


def _parse_at(at: Optional[str]) -> Optional[datetime]:
    if not at:
        return None
    try:
        dt = datetime.fromisoformat(at)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=MELB_TZ)
        return dt
    except (ValueError, TypeError) as e:
        raise HTTPException(status_code=400, detail=f"Invalid 'at' datetime: {e}") from e


@router.get(
    "",
    response_model=PressureResponse,
    summary="Get parking pressure for all zones",
)
def get_pressure(
    request: Request,
    at: Optional[str] = Query(None, description="ISO-8601 datetime (default: now Melbourne time)"),
    horizon: str = Query("now", description="Time horizon label", regex="^(now|1h|3h|6h)$"),
):
    if not is_gold_loaded():
        raise HTTPException(status_code=503, detail="Pressure data not loaded yet")

    query_time = _parse_at(at) or datetime.now(MELB_TZ)
    zones = compute_pressure(at=query_time, horizon=horizon)

    return {
        "generated_at": datetime.now(MELB_TZ).isoformat(),
        "query_time": query_time.isoformat(),
        "horizon": horizon,
        "data_sources": {
            "sensors": DataSourceStatus(status="live", detail="5-min cache"),
            "traffic_profile": DataSourceStatus(status="historical", detail="SCATS monthly"),
            "events": DataSourceStatus(status="scheduled", detail="Eventfinda 30-day window"),
        },
        "zones": zones,
    }


@router.get(
    "/alternatives",
    response_model=AlternativesResponse,
    summary="Find lower-pressure zones near a destination",
)
def get_alternatives(
    request: Request,
    lat: float = Query(..., ge=-90.0, le=90.0, description="Destination latitude"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Destination longitude"),
    at: Optional[str] = Query(None, description="ISO-8601 datetime (default: now)"),
    radius: int = Query(800, ge=100, le=2000, description="Search radius in metres"),
    limit: int = Query(3, ge=1, le=10, description="Max alternatives to return"),
):
    if not is_gold_loaded():
        raise HTTPException(status_code=503, detail="Pressure data not loaded yet")

    query_time = _parse_at(at)
    result = find_alternatives(
        lat=lat, lon=lon, at=query_time,
        radius_m=radius, limit=limit,
    )
    return result


@router.get(
    "/zones/geojson",
    summary="Get zone boundary polygons as GeoJSON",
)
def get_zones_geojson():
    if not is_gold_loaded():
        raise HTTPException(status_code=503, detail="Pressure data not loaded yet")
    return get_zone_hulls_geojson()
