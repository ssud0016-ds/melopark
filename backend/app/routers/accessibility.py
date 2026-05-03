"""Epic 4 accessibility endpoints."""

from __future__ import annotations

import logging
import time

from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)

from app.schemas.accessibility import AccessibilityNearbyResponse
from app.services.accessibility_service import (
    find_nearby_disability_bays,
    get_accessibility_points,
    get_all_disability_bays,
)

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


@router.get(
    "/all",
    summary="Get all accessibility bays",
)
def get_all_accessibility_bays(
    top_n: int = Query(5000, ge=1, le=10000, description="Maximum bays to return"),
    available_only: bool = Query(False, description="Return only bays currently available"),
) -> dict:
    """Return all disability-only bays (not destination-radius limited)."""
    t_route = time.perf_counter()
    logger.info(
        "accessibility_all route_enter top_n=%s available_only=%s",
        top_n,
        available_only,
    )
    try:
        return get_all_disability_bays(top_n=top_n, available_only=available_only)
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail="Accessibility data unavailable",
        ) from exc
    finally:
        logger.info(
            "accessibility_all route_total_ms=%.1f top_n=%s available_only=%s",
            (time.perf_counter() - t_route) * 1000.0,
            top_n,
            available_only,
        )
