"""Epic 5 parking pressure endpoints."""

from __future__ import annotations

import hashlib
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query, Request, Response

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
from app.services import segment_pressure_service as sps
from app.services.segment_tiles_service import build_tile_with_metadata

DATA_ATTRIBUTION = "© City of Melbourne (CC BY 4.0) · Events © Eventfinda"
DATA_ATTRIBUTION_HTML = "&copy; City of Melbourne (CC BY 4.0) &middot; Events &copy; Eventfinda"

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
    horizon: str = Query("now", description="Time horizon label", pattern="^(now|1h|3h|6h)$"),
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
        if not sps.is_loaded():
            raise HTTPException(status_code=503, detail="Pressure data not loaded yet")
        return _fallback_alternatives_from_segments(
            lat=lat,
            lon=lon,
            radius=radius,
            limit=limit,
        )

    query_time = _parse_at(at)
    result = find_alternatives(
        lat=lat, lon=lon, at=query_time,
        radius_m=radius, limit=limit,
    )
    return result


def _trend_for_zone(trend: str) -> str:
    if trend == "up":
        return "rising"
    if trend == "down":
        return "falling"
    return "stable"


def _stable_zone_id(raw_id: str) -> int:
    digest = hashlib.md5(str(raw_id).encode()).hexdigest()[:8]
    return int(digest, 16)


def _fallback_alternatives_from_segments(lat: float, lon: float, radius: int, limit: int) -> dict:
    _, rows, _ = sps.get_pressure_by_data_version()
    scope_df = sps.get_pressure_scope_df()
    if scope_df.empty or not rows:
        return {"target_zone": None, "alternatives": [], "fallback_mode": "segment_pressure"}

    mids = {
        str(r["segment_id"]): (float(r["mid_lat"]), float(r["mid_lon"]))
        for _, r in scope_df.iterrows()
    }
    scored = [r for r in rows if r.get("pressure") is not None and str(r.get("segment_id")) in mids]
    if not scored:
        return {"target_zone": None, "alternatives": [], "fallback_mode": "segment_pressure"}

    def dist_m(seg_row: dict) -> float:
        sid = str(seg_row["segment_id"])
        mid_lat, mid_lon = mids[sid]
        return sps._haversine_m(lat, lon, mid_lat, mid_lon)

    target = min(scored, key=dist_m)
    target_pressure = float(target.get("pressure", 1.0))
    target_level = str(target.get("level", "unknown"))
    target_rank = {"low": 0, "medium": 1, "high": 2, "unknown": 3}.get(target_level, 3)

    candidates = []
    for row in scored:
        sid = str(row["segment_id"])
        if sid == str(target["segment_id"]):
            continue
        d = dist_m(row)
        if d > radius:
            continue
        level = str(row.get("level", "unknown"))
        rank = {"low": 0, "medium": 1, "high": 2, "unknown": 3}.get(level, 3)
        pressure = float(row.get("pressure", 1.0))
        if not (rank < target_rank or pressure < target_pressure):
            continue
        mid_lat, mid_lon = mids[sid]
        walk_minutes = max(1, int(round((d * 1.4) / 83.3)))
        candidates.append({
            "zone_id": _stable_zone_id(sid),
            "label": row.get("street_name") or f"Segment {sid}",
            "pressure": pressure,
            "level": level,
            "free_bays": int(row.get("free_bays", 0)),
            "walk_minutes": walk_minutes,
            "walk_distance_m": int(round(d)),
            "centroid_lat": mid_lat,
            "centroid_lon": mid_lon,
        })

    candidates.sort(key=lambda r: ({"low": 0, "medium": 1, "high": 2, "unknown": 3}.get(r["level"], 3), r["pressure"], r["walk_distance_m"]))
    candidates = candidates[:limit]

    target_sid = str(target["segment_id"])
    target_lat, target_lon = mids[target_sid]
    target_zone = {
        "zone_id": _stable_zone_id(target_sid),
        "label": target.get("street_name") or f"Segment {target_sid}",
        "centroid_lat": target_lat,
        "centroid_lon": target_lon,
        "pressure": target_pressure,
        "level": target_level,
        "trend": _trend_for_zone(str(target.get("trend", "flat"))),
        "components": {
            "occupancy_pct": float(target.get("components", {}).get("occupancy_pct", 0.0)),
            "traffic_z": float(target.get("components", {}).get("traffic_z", 0.0)),
            "event_load": float(target.get("components", {}).get("event_load", 0.0)),
        },
        "total_bays": int(target.get("total_bays", 0)),
        "occupied_bays": int(target.get("occupied_bays", 0)),
        "free_bays": int(target.get("free_bays", 0)),
        "events_nearby": [],
    }
    return {
        "target_zone": target_zone,
        "alternatives": candidates,
        "fallback_mode": "segment_pressure",
    }


@router.get(
    "/zones/geojson",
    summary="Get zone boundary polygons as GeoJSON",
)
def get_zones_geojson():
    if not is_gold_loaded():
        raise HTTPException(status_code=503, detail="Pressure data not loaded yet")
    return get_zone_hulls_geojson()


# ─────────────────────────────────────────────────────────────────────────────
# Vector tile overlay (segment polylines)
# ─────────────────────────────────────────────────────────────────────────────


@router.get(
    "/tiles/manifest.json",
    summary="Tile manifest with current minute_bucket and data sources",
)
def get_tile_manifest(request: Request):
    if not sps.is_loaded():
        raise HTTPException(status_code=503, detail="Segment pressure data not loaded yet")

    bucket, rows, active_event_count = sps.get_pressure_by_data_version()
    now_melb = datetime.now(MELB_TZ)
    base = str(request.base_url).rstrip("/")
    return {
        "generated_at": now_melb.isoformat(),
        "minute_bucket": bucket,
        "data_version": bucket,
        "total_segments": len(rows),
        "data_sources": {
            "sensors": {"status": "live", "detail": "5-min cache"},
            "traffic_profile": {"status": "historical", "detail": "SCATS monthly"},
            "events": {"status": "scheduled", "detail": "Eventfinda 30-day window"},
        },
        "events": {"active_count": active_event_count},
        "attribution": DATA_ATTRIBUTION,
        "tile_url_template": f"{base}/api/pressure/tiles/{{z}}/{{x}}/{{y}}.mvt",
        "min_zoom": 13,
        "max_zoom": 19,
    }


@router.get(
    "/tiles/{z}/{x}/{y}.mvt",
    summary="Mapbox Vector Tile of segment pressure",
)
def get_tile(z: int, x: int, y: int, response: Response):
    if not sps.is_loaded():
        raise HTTPException(status_code=503, detail="Segment pressure data not loaded yet")
    if z < 13 or z > 19:
        raise HTTPException(status_code=404, detail="Tile out of supported zoom range (13-19)")
    if x < 0 or y < 0 or x >= 2 ** z or y >= 2 ** z:
        raise HTTPException(status_code=404, detail="Tile coords out of range")

    body, meta = build_tile_with_metadata(z, x, y)
    bucket = meta["data_version"]
    etag = hashlib.md5(f"{bucket}-{z}-{x}-{y}-{len(body)}".encode()).hexdigest()
    return Response(
        content=body,
        media_type="application/vnd.mapbox-vector-tile",
        headers={
            "Cache-Control": "public, max-age=60",
            "ETag": f'"{etag}"',
            "X-Attribution": DATA_ATTRIBUTION_HTML,
            "X-Tile-Cache": str(meta["cache"]),
            "X-Tile-Build-Ms": f'{meta["build_ms"]:.1f}',
            "X-Pressure-Version": str(bucket),
        },
    )


@router.get(
    "/segments",
    summary="List segments within a bounding box, ordered by pressure ascending",
)
def get_segments_bbox(
    bbox: str = Query(..., description="minLon,minLat,maxLon,maxLat"),
    limit: int = Query(3, ge=1, le=150, description="Max segments to return"),
):
    if not sps.is_loaded():
        raise HTTPException(status_code=503, detail="Segment pressure data not loaded yet")

    parts = bbox.split(",")
    if len(parts) != 4:
        raise HTTPException(status_code=422, detail="bbox must be 'minLon,minLat,maxLon,maxLat'")
    try:
        min_lon, min_lat, max_lon, max_lat = (float(p) for p in parts)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail="bbox values must be finite floats") from exc
    import math as _math
    if any(_math.isnan(v) or _math.isinf(v) for v in (min_lon, min_lat, max_lon, max_lat)):
        raise HTTPException(status_code=422, detail="bbox values must be finite floats")

    _, rows, _ = sps.get_pressure_by_data_version()
    df = sps.get_pressure_scope_df()

    seg_mid: dict[str, tuple[float, float]] = {
        row["segment_id"]: (float(row["mid_lat"]), float(row["mid_lon"]))
        for _, row in df.iterrows()
    }

    results = []
    for r in rows:
        mid = seg_mid.get(r["segment_id"])
        if mid is None:
            continue
        mid_lat, mid_lon = mid
        if not (min_lat <= mid_lat <= max_lat and min_lon <= mid_lon <= max_lon):
            continue
        if r.get("pressure") is None:
            continue
        results.append({
            "segment_id": r["segment_id"],
            "street_name": r.get("street_name", ""),
            "pressure": r["pressure"],
            "level": r["level"],
            "free": int(r.get("free_bays", 0)),
            "total": int(r.get("total_bays", 0)),
            "has_live_bays": bool(r.get("has_live_bays", False)),
            "mid_lat": round(mid_lat, 5),
            "mid_lon": round(mid_lon, 5),
        })

    results.sort(key=lambda x: x["pressure"])
    return results[:limit]


@router.get(
    "/segments/{segment_id}",
    summary="Pressure detail for a single segment",
)
def get_segment(segment_id: str):
    if not sps.is_loaded():
        raise HTTPException(status_code=503, detail="Segment pressure data not loaded yet")
    detail = sps.build_segment_public_detail(segment_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Segment not found")
    return detail
