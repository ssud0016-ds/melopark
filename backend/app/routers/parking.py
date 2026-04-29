"""Parking data endpoints."""

from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

from app.services.parking_service import (
    SensorCacheEmptyError,
    fetch_parking_bays,
    predict_occupancy_for_arrival,
    predict_zone_pressure_for_arrival,
    fetch_raw_parking_bays,
)

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/parking", tags=["parking"])
_MELBOURNE_TZ = ZoneInfo("Australia/Melbourne")


@router.get("", summary="Cleaned parking bays for frontend use")
@limiter.limit("30/minute")
async def get_parking_bays(request: Request):
    """Return simplified, frontend-ready parking bay records.

    Each record contains bay_id, lat, lng, status (free/occupied/unknown),
    and last_updated. Records with no location data are excluded.
    """
    try:
        return await fetch_parking_bays()
    except SensorCacheEmptyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Parking data is not available yet — the server is still loading or the upstream API is temporarily unavailable. Please try again shortly.",
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream API returned {exc.response.status_code}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Could not reach upstream API: {exc}",
        ) from exc


@router.get("/raw")
@limiter.limit("30/minute")
async def get_raw_parking_bays(request: Request):
    """Return raw parking bay data (from cache) as-is from the upstream source."""
    try:
        data = await fetch_raw_parking_bays()
        return {"count": len(data), "data": data}
    except SensorCacheEmptyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Parking data is not available yet — cache is still loading.",
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Upstream API returned {exc.response.status_code}",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Could not reach upstream API: {exc}",
        ) from exc


@router.get("/predicted-occupancy", summary="Predicted occupancy for arrival time")
@limiter.limit("30/minute")
async def get_predicted_occupancy(
    request: Request,
    arrival_iso: str = Query(
        ...,
        description="ISO-8601 arrival time (e.g. 2026-04-14T10:30:00).",
    ),
):
    """Predict occupancy percentage for a target arrival time.

    Uses historical sensor snapshots collected from live refreshes.
    """
    try:
        arrival = datetime.fromisoformat(arrival_iso)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="arrival_iso must be a valid ISO-8601 datetime") from exc

    if arrival.tzinfo is None:
        arrival = arrival.replace(tzinfo=_MELBOURNE_TZ)

    prediction = await predict_occupancy_for_arrival(arrival)
    if prediction is None:
        raise HTTPException(
            status_code=503,
            detail="Prediction is not available yet because historical sensor data is insufficient.",
        )
    return {
        "arrival_iso": arrival.isoformat(),
        **prediction,
    }


@router.get("/predicted-zone-pressure", summary="Predicted pressure by CBD zone")
@limiter.limit("30/minute")
async def get_predicted_zone_pressure(
    request: Request,
    arrival_iso: str = Query(
        ...,
        description="ISO-8601 arrival time (e.g. 2026-04-14T10:30:00).",
    ),
):
    """Predict pressure level for each zone at a target arrival time."""
    try:
        arrival = datetime.fromisoformat(arrival_iso)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="arrival_iso must be a valid ISO-8601 datetime") from exc

    if arrival.tzinfo is None:
        arrival = arrival.replace(tzinfo=_MELBOURNE_TZ)

    zones = await predict_zone_pressure_for_arrival(arrival)
    return {
        "arrival_iso": arrival.isoformat(),
        "zones": zones,
    }
