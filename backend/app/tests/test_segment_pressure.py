"""Tests for segment_pressure_service + tile router."""

from __future__ import annotations

import math
import os
from datetime import datetime

# Disable tile pre-warm during tests so startup completes instantly.
os.environ.setdefault("MELOPARK_TILE_PREWARM", "0")

import mapbox_vector_tile
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from shapely.geometry import LineString
from unittest.mock import patch

from app.routers import pressure as pressure_router
from app.main import app
from app.services import segment_pressure_service as sps
from app.services.segment_tiles_service import build_tile, build_tile_with_metadata

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def _load_segments():
    sps.load_segment_data()
    yield


def test_segment_data_loads():
    assert sps.is_loaded()
    assert not sps.get_segments_df().empty


def test_pct_rank_basic():
    assert sps._pct_rank([]) == []
    assert sps._pct_rank([5.0]) == [0.0]
    out = sps._pct_rank([10.0, 20.0, 30.0])
    assert out[0] == 0.0
    assert out[1] == 0.5
    assert out[2] == 1.0


def test_haversine_known_distance():
    # Melbourne CBD landmarks: Flinders St → Parliament ≈ 1100 m
    d = sps._haversine_m(-37.8183, 144.9671, -37.8108, 144.9737)
    assert 700 < d < 1500


def test_compute_segment_pressure_returns_levels():
    rows = sps.compute_segment_pressure()
    assert len(rows) > 0
    levels = {r["level"] for r in rows}
    assert levels.issubset({"low", "medium", "high", "unknown"})
    # All scored rows have pressure in [0, 1]
    for r in rows:
        if r["level"] != "unknown":
            assert 0.0 <= r["pressure"] <= 1.0


def test_pressure_scope_requires_parking_zone_numbers():
    assert sps.is_segment_in_pressure_scope(pd.Series({"zone_numbers": [7001], "total_bays": 1}))
    assert not sps.is_segment_in_pressure_scope(pd.Series({"zone_numbers": [], "total_bays": 1}))
    assert not sps.is_segment_in_pressure_scope(pd.Series({"zone_numbers": None, "total_bays": 1}))
    assert not sps.is_segment_in_pressure_scope(pd.Series({"zone_numbers": [7001], "total_bays": 0}))


def test_compute_segment_pressure_excludes_segments_without_parking_zones(monkeypatch):
    df = pd.DataFrame([
        {
            "segment_id": "in-zone",
            "street_name": "Scoped Street",
            "seg_descr": "Scoped Street between A and B",
            "total_bays": 2,
            "zone_numbers": [7001],
        },
        {
            "segment_id": "out-of-zone",
            "street_name": "Context Road",
            "seg_descr": "Context Road between A and B",
            "total_bays": 2,
            "zone_numbers": [],
        },
        {
            "segment_id": "zone-no-bays",
            "street_name": "No Bays Road",
            "seg_descr": "No Bays Road between A and B",
            "total_bays": 0,
            "zone_numbers": [7001],
        },
    ])
    monkeypatch.setattr(sps, "_segments_df", df)
    monkeypatch.setattr(sps, "_loaded", True)
    monkeypatch.setattr(
        sps,
        "_segment_occupancy",
        lambda: {
            "in-zone": {"occupied": 1, "total": 2, "pct": 0.5},
            "out-of-zone": {"occupied": 2, "total": 2, "pct": 1.0},
            "zone-no-bays": {"occupied": 0, "total": 0, "pct": 0.0},
        },
    )
    monkeypatch.setattr(sps, "_segment_traffic_z", lambda at: {"in-zone": 1.0, "out-of-zone": 2.0})
    monkeypatch.setattr(sps, "_active_events", lambda at: pd.DataFrame())
    monkeypatch.setattr(sps, "_segment_event_load", lambda active: {})

    rows = sps.compute_segment_pressure()

    assert [r["segment_id"] for r in rows] == ["in-zone"]
    assert rows[0]["street_name"] == "Scoped Street"


def test_compute_segment_pressure_marks_unknown_when_no_live_traffic_or_events(monkeypatch):
    df = pd.DataFrame([
        {
            "segment_id": "in-zone",
            "street_name": "Scoped Street",
            "seg_descr": "Scoped Street between A and B",
            "total_bays": 2,
            "zone_numbers": [7001],
        },
    ])
    monkeypatch.setattr(sps, "_segments_df", df)
    monkeypatch.setattr(sps, "_loaded", True)
    monkeypatch.setattr(sps, "_segment_occupancy", lambda: {})
    monkeypatch.setattr(sps, "_segment_traffic_z", lambda at: {})
    monkeypatch.setattr(sps, "_active_events", lambda at: pd.DataFrame())
    monkeypatch.setattr(sps, "_segment_event_load", lambda active: {})

    rows = sps.compute_segment_pressure()

    assert len(rows) == 1
    assert rows[0]["segment_id"] == "in-zone"
    assert rows[0]["level"] == "unknown"
    assert rows[0]["pressure"] is None
    assert rows[0]["has_live_bays"] is False
    assert rows[0]["sampled_bays"] == 0


def test_minute_bucket_cache_returns_same_key_within_minute():
    k1, _ = sps.get_pressure_by_minute()
    k2, _ = sps.get_pressure_by_minute()
    assert k1 == k2


def test_segment_detail_returns_known_segment():
    df = sps.get_pressure_scope_df()
    sid = df.iloc[0]["segment_id"]
    detail = sps.get_segment_detail(sid)
    assert detail is not None
    assert detail["segment_id"] == sid


def test_segment_detail_unknown_returns_none():
    assert sps.get_segment_detail("DOES_NOT_EXIST_999999") is None


def test_build_tile_returns_bytes():
    # CBD tile at z=15 should have content
    z, x, y = 15, 29578, 20106
    body = build_tile(z, x, y)
    assert isinstance(body, bytes)
    assert len(body) > 0


def test_build_tile_empty_for_ocean_tile():
    # Tile far from Melbourne (e.g. Pacific Ocean): no segments
    z, x, y = 14, 0, 0
    body = build_tile(z, x, y)
    assert body == b""


def test_build_tile_excludes_segments_without_parking_zones(monkeypatch):
    import app.services.segment_tiles_service as sts

    df = pd.DataFrame([
        {
            "segment_id": "in-zone",
            "street_name": "Scoped Street",
            "total_bays": 3,
            "zone_numbers": [7001],
            "bbox_minlon": -1.0,
            "bbox_minlat": 0.0,
            "bbox_maxlon": -0.5,
            "bbox_maxlat": 0.1,
        },
        {
            "segment_id": "out-of-zone",
            "street_name": "Context Road",
            "total_bays": 3,
            "zone_numbers": [],
            "bbox_minlon": 0.5,
            "bbox_minlat": 0.0,
            "bbox_maxlon": 1.0,
            "bbox_maxlat": 0.1,
        },
        {
            "segment_id": "zone-no-bays",
            "street_name": "No Bays Road",
            "total_bays": 0,
            "zone_numbers": [7001],
            "bbox_minlon": 1.5,
            "bbox_minlat": 0.0,
            "bbox_maxlon": 2.0,
            "bbox_maxlat": 0.1,
        },
    ])
    monkeypatch.setattr(sps, "_segments_df", df)
    monkeypatch.setattr(sps, "_loaded", True)
    monkeypatch.setattr(
        sps,
        "_segment_geom",
        {
            "in-zone": LineString([(-1.0, 0.0), (-0.5, 0.1)]),
            "out-of-zone": LineString([(0.5, 0.0), (1.0, 0.1)]),
            "zone-no-bays": LineString([(1.5, 0.0), (2.0, 0.1)]),
        },
    )
    monkeypatch.setattr(
        sps,
        "get_pressure_by_minute",
        lambda at=None: (
            "test-bucket",
            [{
                "segment_id": "in-zone",
                "level": "low",
                "trend": "flat",
                "free_bays": 2,
                "events_nearby": [],
                "pressure": 0.1,
            }],
        ),
    )

    body = sts._build_tile_uncached(0, 0, 0)
    decoded = mapbox_vector_tile.decode(body)
    feature_ids = {
        feature["properties"]["id"]
        for feature in decoded["pressure"]["features"]
    }

    assert feature_ids == {"in-zone"}


def test_router_manifest_endpoint():
    r = client.get("/api/pressure/tiles/manifest.json")
    assert r.status_code == 200
    data = r.json()
    assert "minute_bucket" in data
    assert "data_version" in data
    assert data["data_version"] == data["minute_bucket"]
    assert "attribution" in data
    assert data["attribution"] == "© City of Melbourne (CC BY 4.0) · Events © Eventfinda"
    assert data["min_zoom"] == 13
    assert data["max_zoom"] == 19


def test_router_manifest_counts_active_events_from_events_nearby(monkeypatch):
    now = datetime.now(pressure_router.MELB_TZ)
    monkeypatch.setattr(sps, "is_loaded", lambda: True)
    monkeypatch.setattr(
        sps,
        "get_pressure_by_data_version",
        lambda: (
            "test-bucket",
            [
                {"segment_id": "a", "events_nearby": [{"start_iso": now.isoformat()}]},
                {"segment_id": "b", "events_nearby": [{"start_iso": (now.replace(year=now.year + 1)).isoformat()}]},
                {"segment_id": "c", "events_nearby": []},
            ],
        ),
    )
    data = pressure_router.get_tile_manifest()
    assert data["events"]["active_count"] == 1


def test_router_tile_endpoint_returns_mvt():
    r = client.get("/api/pressure/tiles/15/29578/20106.mvt")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/vnd.mapbox-vector-tile"
    assert "ETag" in r.headers
    assert "max-age=60" in r.headers["cache-control"]
    assert r.headers["x-tile-cache"] in {"hit", "miss"}
    assert "x-tile-build-ms" in r.headers
    assert "x-pressure-version" in r.headers


def test_router_tile_rejects_out_of_range_zoom():
    r = client.get("/api/pressure/tiles/5/1/1.mvt")
    assert r.status_code == 404


def test_router_segment_detail_endpoint():
    df = sps.get_pressure_scope_df()
    sid = df.iloc[0]["segment_id"]
    r = client.get(f"/api/pressure/segments/{sid}")
    assert r.status_code == 200
    data = r.json()
    assert data["segment_id"] == sid
    assert "street_name" in data
    assert "occ_pct" in data
    assert data["trend"] in ("up", "flat", "down")
    assert "events" in data and isinstance(data["events"], list)
    for ev in data["events"]:
        assert set(ev.keys()) >= {"name", "start_iso", "distance_m"}
        assert isinstance(ev["distance_m"], int)
        assert ev["distance_m"] <= 1500


def test_router_segment_detail_unknown_404():
    r = client.get("/api/pressure/segments/UNKNOWN_999999")
    assert r.status_code == 404


def test_router_segments_bbox_returns_list():
    # Melbourne CBD bounding box
    bbox = "144.95,-37.82,144.98,-37.80"
    r = client.get(f"/api/pressure/segments?bbox={bbox}&limit=3")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) <= 3
    for item in data:
        assert set(item.keys()) >= {"segment_id", "street_name", "pressure", "level", "free", "total", "has_live_bays", "mid_lat", "mid_lon"}
        assert 0.0 <= item["pressure"] <= 1.0
        assert item["level"] in ("low", "medium", "high")


def test_router_segments_bbox_ordered_ascending():
    bbox = "144.95,-37.82,144.98,-37.80"
    r = client.get(f"/api/pressure/segments?bbox={bbox}&limit=10")
    assert r.status_code == 200
    data = r.json()
    pressures = [item["pressure"] for item in data]
    assert pressures == sorted(pressures)


def test_router_segments_bbox_allows_trend_marker_limit():
    bbox = "144.95,-37.82,144.98,-37.80"
    r = client.get(f"/api/pressure/segments?bbox={bbox}&limit=150")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_router_segments_bbox_excludes_segments_without_parking_zones(monkeypatch):
    scope_df = pd.DataFrame([
        {"segment_id": "in-zone", "mid_lat": 0.0, "mid_lon": 0.0},
    ])
    monkeypatch.setattr(sps, "is_loaded", lambda: True)
    monkeypatch.setattr(sps, "get_pressure_scope_df", lambda: scope_df)
    monkeypatch.setattr(
        sps,
        "get_pressure_by_data_version",
        lambda: (
            "test-bucket",
            [
                {
                    "segment_id": "in-zone",
                    "street_name": "Scoped Street",
                    "pressure": 0.1,
                    "level": "low",
                    "free_bays": 2,
                    "total_bays": 3,
                },
                {
                    "segment_id": "out-of-zone",
                    "street_name": "Context Road",
                    "pressure": 0.2,
                    "level": "low",
                    "free_bays": 2,
                    "total_bays": 3,
                },
            ],
        ),
    )

    data = pressure_router.get_segments_bbox(bbox="-1,-1,1,1", limit=10)

    assert [item["segment_id"] for item in data] == ["in-zone"]


def test_router_segments_bbox_missing_422():
    r = client.get("/api/pressure/segments")
    assert r.status_code == 422


def test_router_segments_bbox_malformed_422():
    r = client.get("/api/pressure/segments?bbox=bad,values,here")
    assert r.status_code == 422


def test_router_segments_bbox_non_float_422():
    r = client.get("/api/pressure/segments?bbox=a,b,c,d")
    assert r.status_code == 422


def test_router_alternatives_falls_back_to_segment_pressure_when_gold_missing(monkeypatch):
    monkeypatch.setattr(pressure_router, "is_gold_loaded", lambda: False)
    monkeypatch.setattr(sps, "is_loaded", lambda: True)
    monkeypatch.setattr(
        sps,
        "get_pressure_by_data_version",
        lambda: (
            "v1",
            [
                {
                    "segment_id": "seg-a",
                    "street_name": "Target St",
                    "pressure": 0.8,
                    "level": "high",
                    "trend": "up",
                    "free_bays": 1,
                    "total_bays": 10,
                    "occupied_bays": 9,
                    "components": {"occupancy_pct": 0.9, "traffic_z": 0.8, "event_load": 0.4},
                },
                {
                    "segment_id": "seg-b",
                    "street_name": "Better St",
                    "pressure": 0.2,
                    "level": "low",
                    "trend": "flat",
                    "free_bays": 8,
                    "total_bays": 10,
                    "occupied_bays": 2,
                    "components": {"occupancy_pct": 0.2, "traffic_z": 0.2, "event_load": 0.0},
                },
            ],
        ),
    )
    monkeypatch.setattr(
        sps,
        "get_pressure_scope_df",
        lambda: pd.DataFrame([
            {"segment_id": "seg-a", "mid_lat": -37.81, "mid_lon": 144.96},
            {"segment_id": "seg-b", "mid_lat": -37.8105, "mid_lon": 144.9605},
        ]),
    )

    r = client.get("/api/pressure/alternatives?lat=-37.81&lon=144.96&radius=800&limit=3")
    assert r.status_code == 200
    data = r.json()
    assert data["fallback_mode"] == "segment_pressure"
    assert data["target_zone"]["label"] == "Target St"
    assert len(data["alternatives"]) == 1
    assert data["alternatives"][0]["label"] == "Better St"


# ── B7 — server-side tile LRU cache ──────────────────────────────────────────

def test_tile_lru_cache_calls_compute_once_within_same_data_version():
    """Calling build_tile twice with same z/x/y and data version
    should invoke the underlying tile builder only once."""
    import app.services.segment_tiles_service as sts

    z, x, y = 15, 29578, 20106
    sentinel = b"fake-tile-bytes"

    # Clear the module-level cache so prior test runs don't interfere.
    with sts._tile_cache_lock:
        sts._tile_cache.clear()

    with patch.object(sts, "_build_tile_uncached", return_value=sentinel) as mock_build:
        result1 = sts.build_tile(z, x, y)
        result2 = sts.build_tile(z, x, y)

    assert result1 == sentinel
    assert result2 == sentinel
    mock_build.assert_called_once()


def test_tile_metadata_reports_miss_then_hit():
    import app.services.segment_tiles_service as sts

    z, x, y = 15, 29578, 20106

    with sts._tile_cache_lock:
        sts._tile_cache.clear()

    body1, meta1 = build_tile_with_metadata(z, x, y)
    body2, meta2 = build_tile_with_metadata(z, x, y)

    assert body1 == body2
    assert meta1["cache"] == "miss"
    assert meta2["cache"] == "hit"
    assert meta1["data_version"] == meta2["data_version"]
    assert meta1["build_ms"] >= 0


def test_tile_lru_cache_misses_different_tiles():
    """Different (z, x, y) coordinates should each call the builder."""
    import app.services.segment_tiles_service as sts

    with sts._tile_cache_lock:
        sts._tile_cache.clear()

    with patch.object(sts, "_build_tile_uncached", return_value=b"data") as mock_build:
        sts.build_tile(15, 1, 1)
        sts.build_tile(15, 1, 2)

    assert mock_build.call_count == 2
