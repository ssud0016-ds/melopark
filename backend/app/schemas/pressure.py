"""Pydantic schemas for Epic 5 parking pressure endpoints."""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class NearbyEvent(BaseModel):
    event_name: str
    category: Optional[str] = None
    starts: str
    ends: Optional[str] = None
    distance_m: int


class PressureComponents(BaseModel):
    occupancy_pct: float
    traffic_z: float
    event_load: float


class ZonePressure(BaseModel):
    zone_id: int
    label: str
    centroid_lat: float
    centroid_lon: float
    pressure: float
    level: str  # "low" | "medium" | "high"
    trend: str  # "rising" | "stable" | "falling"
    components: PressureComponents
    total_bays: int
    occupied_bays: int
    free_bays: int
    events_nearby: list[NearbyEvent]


class DataSourceStatus(BaseModel):
    status: str
    detail: Optional[str] = None


class PressureResponse(BaseModel):
    generated_at: str
    query_time: str
    horizon: str
    data_sources: dict[str, DataSourceStatus]
    zones: list[ZonePressure]


class AlternativeZone(BaseModel):
    zone_id: int
    label: str
    pressure: float
    level: str
    free_bays: int
    walk_minutes: int
    walk_distance_m: int
    centroid_lat: float
    centroid_lon: float


class AlternativesResponse(BaseModel):
    target_zone: Optional[ZonePressure] = None
    alternatives: list[AlternativeZone]
    fallback_mode: Optional[str] = None
