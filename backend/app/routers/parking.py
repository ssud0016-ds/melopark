"""Parking data endpoints."""

import httpx
from fastapi import APIRouter, HTTPException

from app.services.parking_service import fetch_parking_bays, fetch_raw_parking_bays

router = APIRouter(prefix="/api/parking", tags=["parking"])


@router.get("", summary="Cleaned parking bays for frontend use")
async def get_parking_bays():
    """Return simplified, frontend-ready parking bay records.

    Each record contains bay_id, lat, lng, status (free/occupied/unknown),
    and last_updated. Records with no location data are excluded.
    """
    try:
        return await fetch_parking_bays()
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
async def get_raw_parking_bays():
    """Return raw parking bay data from the City of Melbourne Open Data API."""
    try:
        data = await fetch_raw_parking_bays()
        return {"count": len(data), "data": data}
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
