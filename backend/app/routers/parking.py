"""Parking data endpoints."""

import httpx
from fastapi import APIRouter, HTTPException

from app.services.parking_service import fetch_raw_parking_bays

router = APIRouter(prefix="/api/parking", tags=["parking"])


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
