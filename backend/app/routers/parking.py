"""Parking data endpoints."""

import httpx
from fastapi import APIRouter, HTTPException, Request

from app.services.parking_service import (
    SensorCacheEmptyError,
    fetch_parking_bays,
    fetch_raw_parking_bays,
)

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/parking", tags=["parking"])


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
