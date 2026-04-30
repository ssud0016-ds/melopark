"""Epic 4 accessibility endpoints."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query

from app.schemas.accessibility import AccessibilityNearbyResponse
from app.services.accessibility_service import find_nearby_disability_bays, get_accessibility_points

router = APIRouter(prefix="/api/accessibility", tags=["accessibility"])


@router.get(
    "/nearby",
    response_model=AccessibilityNearbyResponse,
    summary="Find nearby disability bays near destination",
)
def get_nearby_disability_bays(
    lat: float = Query(..., ge=-90.0, le=90.0, description="Destination latitude"),
    lon: float = Query(..., ge=-180.0, le=180.0, description="Destination longitude"),
    radius_m: int = Query(500, ge=50, le=50000, description="Search radius in meters"),
    top_n: int = Query(20, ge=1, le=5000, description="Maximum bays to return"),
    available_only: bool = Query(False, description="Return only bays currently available"),
) -> dict:
    """Return disability-only bays nearest to a destination point."""
    try:
        return find_nearby_disability_bays(
            dest_lat=lat,
            dest_lon=lon,
            radius_m=radius_m,
            top_n=top_n,
            available_only=available_only,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail="Accessibility data unavailable",
        ) from exc


@router.get(
    "/points",
    summary="Get raw accessibility points for map overlay",
)
def get_raw_accessibility_points(
    top_n: int = Query(5000, ge=1, le=10000, description="Maximum points to return"),
) -> dict:
    """Return raw accessibility point markers (not limited by live bay overlap)."""
    try:
        return get_accessibility_points(top_n=top_n)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail="Accessibility data unavailable",
        ) from exc
