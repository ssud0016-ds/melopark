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
        raise HTTPException(status_code=503, detail="Pressure data not loaded yet")

    query_time = _parse_at(at)
    result = find_alternatives(
        lat=lat, lon=lon, at=query_time,
        radius_m=radius, limit=limit,
    )
    return result


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
def get_tile_manifest():
    if not sps.is_loaded():
        raise HTTPException(status_code=503, detail="Segment pressure data not loaded yet")

    bucket, rows = sps.get_pressure_by_data_version()
    now_melb = datetime.now(MELB_TZ)
    active_event_count = sum(
        1 for r in rows
        if r.get("events_nearby") and any(
            e.get("start_iso") and datetime.fromisoformat(e["start_iso"]) <= now_melb
            for e in (r["events_nearby"] if isinstance(r["events_nearby"], list) else [])
        )
    )
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
        "tile_url_template": "/api/pressure/tiles/{z}/{x}/{y}.mvt",
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

    _, rows = sps.get_pressure_by_data_version()
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
