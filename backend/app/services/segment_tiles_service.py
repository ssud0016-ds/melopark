"""Mapbox Vector Tile generation for segment pressure overlay.

Tile coords are XYZ (slippy). Coordinates inside MVT are quantized to a 4096
grid relative to tile bounds. Lines are clipped to tile bbox before encoding.
"""

from __future__ import annotations

import logging
import math
import os
import threading
import time
from typing import Optional

import mapbox_vector_tile
from cachetools import LRUCache
from shapely.geometry import LineString, box, mapping
from shapely.ops import transform

from app.services import segment_pressure_service as sps

logger = logging.getLogger(__name__)

TILE_EXTENT = 4096

# B7 — server-side tile LRU cache.
# Key: (z, x, y, data_version) so tiles only invalidate when pressure data can change.
_tile_cache: LRUCache = LRUCache(maxsize=int(os.getenv("MELOPARK_TILE_CACHE_SIZE", "1000")))
_tile_cache_lock = threading.RLock()


def _tile_bounds(z: int, x: int, y: int) -> tuple[float, float, float, float]:
    """Slippy XYZ → (minlon, minlat, maxlon, maxlat) in WGS84."""
    n = 2 ** z
    lon_min = x / n * 360.0 - 180.0
    lon_max = (x + 1) / n * 360.0 - 180.0
    lat_max = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
    lat_min = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 1) / n))))
    return (lon_min, lat_min, lon_max, lat_max)


def _project_to_tile(line: LineString, bounds: tuple[float, float, float, float]) -> LineString:
    """Project lon/lat line into MVT tile-local 4096-grid coordinates.

    Note: MVT y-axis is top-down (origin top-left), so we flip y.
    """
    minlon, minlat, maxlon, maxlat = bounds
    dx = maxlon - minlon
    dy = maxlat - minlat
    if dx <= 0 or dy <= 0:
        return line

    def _proj(lon, lat, z=None):
        gx = (lon - minlon) / dx * TILE_EXTENT
        gy = TILE_EXTENT - (lat - minlat) / dy * TILE_EXTENT
        return (gx, gy)

    return transform(_proj, line)


def _build_tile_uncached(z: int, x: int, y: int, at=None, pressure_rows: Optional[list[dict]] = None) -> bytes:
    """Internal tile builder — call via build_tile() for cached access."""
    if not sps.is_loaded():
        return b""

    bounds = _tile_bounds(z, x, y)
    minlon, minlat, maxlon, maxlat = bounds
    pad_lon = (maxlon - minlon) * 0.05
    pad_lat = (maxlat - minlat) * 0.05
    tile_box = box(
        minlon - pad_lon, minlat - pad_lat,
        maxlon + pad_lon, maxlat + pad_lat,
    )

    df = sps.get_pressure_scope_df()
    geom = sps.get_segment_geom()
    rows = pressure_rows
    if rows is None:
        _, rows, _ = sps.get_pressure_by_data_version(at)
    by_id = {r["segment_id"]: r for r in rows}

    features: list[dict] = []
    for _, srow in df.iterrows():
        # Quick bbox reject
        if (srow["bbox_maxlon"] < tile_box.bounds[0]
                or srow["bbox_minlon"] > tile_box.bounds[2]
                or srow["bbox_maxlat"] < tile_box.bounds[1]
                or srow["bbox_minlat"] > tile_box.bounds[3]):
            continue

        sid = srow["segment_id"]
        line = geom.get(sid)
        if line is None:
            continue
        clipped = line.intersection(tile_box)
        if clipped.is_empty:
            continue
        if clipped.geom_type == "MultiLineString":
            parts = list(clipped.geoms)
        elif clipped.geom_type == "LineString":
            parts = [clipped]
        else:
            continue

        pr = by_id.get(sid)
        # Pre-bake segment midpoint as MVT props so the client can dim by
        # destination distance without per-render trig over tile coords.
        # Quantise to 5 dp (~1 m precision) to keep tile size small.
        mid_lon = round((float(srow["bbox_minlon"]) + float(srow["bbox_maxlon"])) / 2.0, 5)
        mid_lat = round((float(srow["bbox_minlat"]) + float(srow["bbox_maxlat"])) / 2.0, 5)
        props = {
            "id": sid,
            "name": srow["street_name"] or "",
            "level": (pr["level"] if pr else "unknown"),
            "trend": (pr["trend"] if pr else "flat"),
            "total": int(srow["total_bays"]),
            "free": int(pr["free_bays"]) if pr else 0,
            "has_live_bays": bool(pr["has_live_bays"]) if pr else False,
            "sampled_bays": int(pr["sampled_bays"]) if pr else 0,
            "evt": len(pr["events_nearby"]) if pr else 0,
            "mid_lat": mid_lat,
            "mid_lon": mid_lon,
        }
        if pr and pr["pressure"] is not None:
            props["p"] = pr["pressure"]

        for part in parts:
            local = _project_to_tile(part, bounds)
            features.append({
                "geometry": mapping(local),
                "properties": props,
            })

    if not features:
        return b""

    return mapbox_vector_tile.encode(
        [{
            "name": "pressure",
            "features": features,
        }],
        default_options={"extents": TILE_EXTENT, "y_coord_down": True},
    )


def build_tile_with_metadata(z: int, x: int, y: int, at=None) -> tuple[bytes, dict]:
    """Return cached MVT tile plus cache/build metadata for instrumentation.

    Passing ``at`` bypasses cache (used for historical / testing look-ups).
    """
    t0 = time.perf_counter()
    data_version, rows, _ = sps.get_pressure_by_data_version(at)
    if at is not None:
        result = _build_tile_uncached(z, x, y, at=at, pressure_rows=rows)
        elapsed_ms = (time.perf_counter() - t0) * 1000
        return result, {"cache": "bypass", "build_ms": elapsed_ms, "data_version": data_version}

    cache_key = (z, x, y, data_version)
    with _tile_cache_lock:
        if cache_key in _tile_cache:
            elapsed_ms = (time.perf_counter() - t0) * 1000
            return _tile_cache[cache_key], {
                "cache": "hit",
                "build_ms": elapsed_ms,
                "data_version": data_version,
            }
    result = _build_tile_uncached(z, x, y, at=at, pressure_rows=rows)
    with _tile_cache_lock:
        _tile_cache[cache_key] = result
    elapsed_ms = (time.perf_counter() - t0) * 1000
    if elapsed_ms > 100:
        logger.info("slow pressure tile z=%s x=%s y=%s built in %.1fms", z, x, y, elapsed_ms)
    return result, {"cache": "miss", "build_ms": elapsed_ms, "data_version": data_version}


def build_tile(z: int, x: int, y: int, at=None) -> bytes:
    """Return a cached MVT tile for the given z/x/y and current data version."""
    result, _meta = build_tile_with_metadata(z, x, y, at=at)
    return result
