"""Pydantic schemas for Epic 4 accessibility endpoints."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class AccessibilityBay(BaseModel):
    bay_id: str
    lat: Optional[float] = None
    lon: Optional[float] = None
    distance_m: float
    status: str
    is_available_now: bool
    typedesc: Optional[str] = None
    plain_english: Optional[str] = None
    duration_mins: Optional[int] = None
    disabilityext_mins: Optional[int] = None
    starttime: Optional[str] = None
    endtime: Optional[str] = None
    fromday: Optional[int] = None
    today: Optional[int] = None
    has_disability_extension: bool
    lastupdated: Optional[str] = None


class AccessibilityNearbyResponse(BaseModel):
    destination_lat: float
    destination_lon: float
    radius_m: int
    total_candidates: int
    returned: int
    bays: list[AccessibilityBay]

