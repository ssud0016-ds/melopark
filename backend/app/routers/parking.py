"""Parking data endpoints."""

import re
from datetime import datetime
from zoneinfo import ZoneInfo

import httpx
from fastapi import APIRouter, HTTPException, Query, Request, Response

from app.services.parking_service import (
    SensorCacheEmptyError,
    fetch_parking_bays,
    fetch_raw_parking_bays,
    get_duration_filtered_bays,
)

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/parking", tags=["parking"])

_MEL_TZ = ZoneInfo("Australia/Melbourne")
_HHMM_RE = re.compile(r"^\d{2}:\d{2}$")


@router.get("", summary="Cleaned parking bays for frontend use")
@limiter.limit("30/minute")
async def get_parking_bays(request: Request, response: Response):
    """Return simplified, frontend-ready parking bay records."""
    try:
        data = await fetch_parking_bays()
        response.headers["Cache-Control"] = "public, max-age=10, stale-while-revalidate=20"
        return data
    except SensorCacheEmptyError as exc:
        raise HTTPException(
            status_code=503,
            detail="Parking data is not available yet — the server is still loading or the upstream API is temporarily unavailable. Please try again shortly.",
        ) from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Upstream API returned {exc.response.status_code}") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Could not reach upstream API: {exc}") from exc


@router.get("/raw")
@limiter.limit("30/minute")
async def get_raw_parking_bays(request: Request):
    """Return raw parking bay data (from cache) as-is from the upstream source."""
    try:
        data = await fetch_raw_parking_bays()
        return {"count": len(data), "data": data}
    except SensorCacheEmptyError as exc:
        raise HTTPException(status_code=503, detail="Parking data is not available yet — cache is still loading.") from exc
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Upstream API returned {exc.response.status_code}") from exc
    except httpx.RequestError as exc:
        raise HTTPException(status_code=503, detail=f"Could not reach upstream API: {exc}") from exc


@router.get("/filter", summary="Filter bays by needed parking duration, arrival time, and day")
@limiter.limit("60/minute")
def filter_by_duration(
    request: Request,
    needed_mins: int = Query(..., ge=1, le=1440, description="How long you need to park (minutes)"),
    arrival_time: str = Query(default="now", description="Arrival time HH:MM (24h) or 'now'"),
    day: int = Query(default=-1, ge=-1, le=6, description="Day 0=Sun…6=Sat, -1=today in Melbourne"),
):
    """Return bay_ids where parking for needed_mins is allowed at arrival_time on day.

    Bays unrestricted at that time are always included.
    day encoding: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat (matches JS Date.getDay()).
    """
    mel_now = datetime.now(_MEL_TZ)

    if arrival_time == "now" or not _HHMM_RE.match(arrival_time):
        arrival_time = mel_now.strftime("%H:%M")

    if day == -1:
        # Convert Python weekday (0=Mon…6=Sun) to 0=Sun…6=Sat
        day = (mel_now.weekday() + 1) % 7

    bay_ids = get_duration_filtered_bays(needed_mins, arrival_time, day)
    return {"bay_ids": bay_ids}
