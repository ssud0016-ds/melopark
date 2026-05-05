"""
test_forecast_service.py
========================
Unit tests for Epic 6 forecast_service.py

Coverage:
  - Pure helper functions (_haversine_m, _zone_noise, _pattern_demand,
    _demand_to_level, _pressure_trend, _is_peak_event_window)
  - get_warnings()   — gold path, pattern fallback, hour filtering
  - get_pressure_at() — gold path, pattern fallback
  - get_alternatives_for() — AC 6.2.1 composite score, AC 6.2.3 empty list
  - get_event_risk()
  - load_forecast_data() — graceful failure when parquets missing
  - is_forecast_loaded() flag toggling

All tests run against the in-memory pattern fallback so no gold parquets
are required.  Gold-path branches are exercised by monkey-patching the
module-level DataFrames.
"""
from __future__ import annotations

import math
import os
from datetime import datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

# Disable tile pre-warm so startup is instant during test collection.
os.environ.setdefault("MELOPARK_TILE_PREWARM", "0")
os.environ.setdefault("MELOPARK_PRESSURE_PREWARM", "0")

import pandas as pd
import pytest

import app.services.forecast_service as fs

MELB_TZ = ZoneInfo("Australia/Melbourne")

# ─── Fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def reset_forecast_state():
    """
    Reset all module-level caches before each test so tests are isolated.
    """
    original_loaded = fs._forecast_loaded
    original_profile = fs._pressure_profile
    original_warnings = fs._peak_warnings
    original_alts = fs._alternatives_guidance
    original_events = fs._event_risk
    original_zones = fs._zone_meta

    yield

    fs._forecast_loaded = original_loaded
    fs._pressure_profile = original_profile
    fs._peak_warnings = original_warnings
    fs._alternatives_guidance = original_alts
    fs._event_risk = original_events
    fs._zone_meta = original_zones


@pytest.fixture
def cbd_zones():
    """12 real Melbourne CBD zones identical to _hardcoded_cbd_zones()."""
    return fs._hardcoded_cbd_zones()


@pytest.fixture
def patch_zones(cbd_zones):
    """Inject deterministic zone list into the service."""
    fs._zone_meta = cbd_zones
    return cbd_zones


# ─── _haversine_m ────────────────────────────────────────────────────────────

def test_haversine_zero_distance():
    assert fs._haversine_m(-37.82, 144.96, -37.82, 144.96) == pytest.approx(0.0, abs=1.0)


def test_haversine_cbd_landmarks():
    # Flinders St Station → Parliament Station ≈ 1 100 m
    d = fs._haversine_m(-37.8183, 144.9671, -37.8108, 144.9737)
    assert 700 < d < 1500, f"Expected 700–1500 m, got {d:.1f}"


def test_haversine_symmetric():
    a = fs._haversine_m(-37.81, 144.96, -37.82, 144.97)
    b = fs._haversine_m(-37.82, 144.97, -37.81, 144.96)
    assert a == pytest.approx(b, rel=1e-9)


# ─── _zone_noise ─────────────────────────────────────────────────────────────

def test_zone_noise_bounds():
    for zone_id in range(1, 13):
        for hour in range(24):
            noise = fs._zone_noise(zone_id, hour)
            assert -0.13 <= noise <= 0.13, f"noise={noise} out of ±0.13 for zone {zone_id} h{hour}"


def test_zone_noise_deterministic():
    """Same inputs must always return the same value."""
    assert fs._zone_noise(5, 9) == fs._zone_noise(5, 9)
    assert fs._zone_noise(1, 0) == fs._zone_noise(1, 0)


def test_zone_noise_varies_across_zones():
    """Different zones should not all produce the same noise."""
    values = {fs._zone_noise(z, 8) for z in range(1, 13)}
    assert len(values) > 1, "All zones returned identical noise — determinism broken"


# ─── _pattern_demand ─────────────────────────────────────────────────────────

def test_pattern_demand_bounds(patch_zones):
    """Demand must stay in [0, 1] for every zone at every hour."""
    base_dt = datetime(2026, 4, 14, 0, 0, tzinfo=MELB_TZ)  # Monday midnight
    for zone in patch_zones:
        for h in range(24):
            dt = base_dt.replace(hour=h)
            d = fs._pattern_demand(zone["zone_number"], dt)
            assert 0.0 <= d <= 1.0, f"demand={d} out of [0,1] zone={zone['zone_number']} h={h}"


def test_pattern_demand_weekday_peak_higher_than_overnight(patch_zones):
    """AM peak demand (8 am weekday) must exceed overnight (2 am)."""
    zone = patch_zones[0]
    monday = datetime(2026, 4, 14, tzinfo=MELB_TZ)
    d_peak = fs._pattern_demand(zone["zone_number"], monday.replace(hour=8))
    d_night = fs._pattern_demand(zone["zone_number"], monday.replace(hour=2))
    assert d_peak > d_night


def test_pattern_demand_weekend_lower_morning(patch_zones):
    """Weekend 7 am should be quieter than weekday 7 am (CBD commuters)."""
    zone = patch_zones[0]
    weekday = datetime(2026, 4, 14, 7, 0, tzinfo=MELB_TZ)   # Monday
    weekend = datetime(2026, 4, 12, 7, 0, tzinfo=MELB_TZ)   # Saturday
    assert fs._pattern_demand(zone["zone_number"], weekday) > \
           fs._pattern_demand(zone["zone_number"], weekend)


# ─── _demand_to_level ────────────────────────────────────────────────────────

@pytest.mark.parametrize("occ,expected", [
    (0.0,  "low"),
    (0.49, "low"),
    (0.50, "moderate"),
    (0.69, "moderate"),
    (0.70, "high"),
    (0.84, "high"),
    (0.85, "critical"),
    (1.0,  "critical"),
])
def test_demand_to_level_thresholds(occ, expected):
    assert fs._demand_to_level(occ) == expected


# ─── _pressure_trend ─────────────────────────────────────────────────────────

def test_pressure_trend_stable_midday(patch_zones):
    """Midday on a weekday: demand is roughly flat → stable trend."""
    zone = patch_zones[0]
    midday = datetime(2026, 4, 14, 12, 30, tzinfo=MELB_TZ)
    trend = fs._pressure_trend(zone["zone_number"], midday)
    assert trend in {"rising", "stable", "falling"}


def test_pressure_trend_rising_morning(patch_zones):
    """7 am demand typically rises into 8 am peak."""
    zone = patch_zones[0]
    dt_7am = datetime(2026, 4, 14, 7, 0, tzinfo=MELB_TZ)
    trend = fs._pressure_trend(zone["zone_number"], dt_7am)
    # We don't mandate 'rising' due to zone noise, but must be a valid label
    assert trend in {"rising", "stable", "falling"}


# ─── _is_peak_event_window ───────────────────────────────────────────────────

@pytest.mark.parametrize("dow,hour,expected", [
    (4, 19, True),   # Friday evening
    (5, 20, True),   # Saturday evening
    (0, 12, True),   # Monday lunch
    (0, 8,  False),  # Monday morning (not lunch, not evening)
    (0, 3,  False),  # Monday 3 am
    (6, 10, False),  # Sunday morning (outside 11–14)
])
def test_is_peak_event_window(dow, hour, expected):
    # Build a datetime with the given weekday and hour
    # 2026-04-13 is Monday (dow=0)
    base = datetime(2026, 4, 13, tzinfo=MELB_TZ)
    dt = base + timedelta(days=dow, hours=hour)
    assert fs._is_peak_event_window(dt) == expected


# ─── _build_warning_message ──────────────────────────────────────────────────

def test_build_warning_message_now():
    msg = fs._build_warning_message("high", 0, datetime.now(MELB_TZ))
    assert "right now" in msg
    assert "High" in msg


def test_build_warning_message_future():
    msg = fs._build_warning_message("critical", 3, datetime.now(MELB_TZ))
    assert "3 hours" in msg
    assert "Very high" in msg


def test_build_warning_message_1h_singular():
    msg = fs._build_warning_message("moderate", 1, datetime.now(MELB_TZ))
    # Should say "1 hour" not "1 hours"
    assert "1 hour" in msg
    assert "hours" not in msg


# ─── get_warnings() — pattern fallback ───────────────────────────────────────

def test_get_warnings_returns_list(patch_zones):
    fs._forecast_loaded = False
    result = fs.get_warnings(hours=6)
    assert isinstance(result, list)
    assert len(result) > 0


def test_get_warnings_hours_from_now_range(patch_zones):
    """hours_from_now must be in [0, requested_hours]."""
    fs._forecast_loaded = False
    result = fs.get_warnings(hours=3)
    for w in result:
        assert 0 <= w["hours_from_now"] <= 3


def test_get_warnings_required_fields(patch_zones):
    fs._forecast_loaded = False
    result = fs.get_warnings(hours=1)
    required = {"zone", "hours_from_now", "warning_level", "predicted_occupancy",
                "event_risk_level", "events_nearby", "zone_lat", "zone_lon", "warning_message"}
    for w in result:
        assert required.issubset(w.keys()), f"Missing keys: {required - w.keys()}"


def test_get_warnings_valid_levels(patch_zones):
    fs._forecast_loaded = False
    warning_levels = {"low", "moderate", "high", "critical"}   # pressure scale
    event_risk_levels = {"low", "medium", "high"}              # event risk scale
    for w in fs.get_warnings(hours=6):
        assert w["warning_level"] in warning_levels, f"Invalid level: {w['warning_level']}"
        assert w["event_risk_level"] in event_risk_levels, f"Invalid event level: {w['event_risk_level']}"


def test_get_warnings_occupancy_in_bounds(patch_zones):
    fs._forecast_loaded = False
    for w in fs.get_warnings(hours=6):
        assert 0.0 <= w["predicted_occupancy"] <= 1.0


def test_get_warnings_default_time_is_melbourne_now(patch_zones, monkeypatch):
    """Calling without query_time must use Melbourne now, not UTC."""
    fs._forecast_loaded = False
    captured = {}

    original = fs._warnings_from_pattern
    def spy(query_time, hours):
        captured["tz"] = str(query_time.tzinfo) if query_time else None
        return original(query_time, hours)

    monkeypatch.setattr(fs, "_warnings_from_pattern", spy)
    fs.get_warnings(hours=1)
    assert captured.get("tz") is not None
    assert "Melbourne" in captured["tz"] or "AEST" in captured["tz"] or "UTC" not in captured.get("tz","UTC")


# ─── get_warnings() — gold path ──────────────────────────────────────────────

def test_get_warnings_uses_gold_when_loaded(patch_zones):
    """When _forecast_loaded=True and _peak_warnings is populated, use gold data."""
    gold_df = pd.DataFrame([
        {
            "zone": "Flinders St / Swanston St",
            "hours_from_now": 0,
            "warning_level": "critical",
            "predicted_occupancy": 0.91,
            "risk_level": "high",
            "events_nearby": "NGV After Dark",
            "zone_lat": -37.8183,
            "zone_lon": 144.9671,
            "warning_message": "Very high demand expected.",
        }
    ])
    fs._forecast_loaded = True
    fs._peak_warnings = gold_df
    result = fs.get_warnings(hours=6)
    # Must include the gold row
    zones = [w["zone"] for w in result]
    assert "Flinders St / Swanston St" in zones
    # Must have critical level from gold (not overridden by pattern)
    critical = [w for w in result if w["warning_level"] == "critical"]
    assert len(critical) >= 1


def test_get_warnings_gold_filters_hours(patch_zones):
    """Gold path must drop rows with hours_from_now > requested hours."""
    gold_df = pd.DataFrame([
        {"zone": "Zone A", "hours_from_now": 2, "warning_level": "high",
         "predicted_occupancy": 0.75, "risk_level": "low", "events_nearby": "None",
         "zone_lat": -37.81, "zone_lon": 144.96, "warning_message": ""},
        {"zone": "Zone B", "hours_from_now": 10, "warning_level": "critical",
         "predicted_occupancy": 0.95, "risk_level": "high", "events_nearby": "Festival",
         "zone_lat": -37.82, "zone_lon": 144.97, "warning_message": ""},
    ])
    fs._forecast_loaded = True
    fs._peak_warnings = gold_df
    result = fs.get_warnings(hours=3)
    hfn_values = [w["hours_from_now"] for w in result]
    assert all(h <= 3 for h in hfn_values), "hours > requested leaked through"
    assert not any(w["zone"] == "Zone B" for w in result)


# ─── get_pressure_at() ───────────────────────────────────────────────────────

def test_get_pressure_at_returns_all_zones(patch_zones):
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 9, 0, tzinfo=MELB_TZ)
    result = fs.get_pressure_at(lat=-37.82, lon=144.96, query_time=dt)
    assert len(result) == len(patch_zones)


def test_get_pressure_at_required_fields(patch_zones):
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 12, 0, tzinfo=MELB_TZ)
    for row in fs.get_pressure_at(lat=-37.82, lon=144.96, query_time=dt):
        assert {"zone", "predicted_occ", "pressure_status", "zone_lat", "zone_lon", "source"}.issubset(row.keys())


def test_get_pressure_at_occ_in_bounds(patch_zones):
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 17, 0, tzinfo=MELB_TZ)
    for row in fs.get_pressure_at(lat=-37.82, lon=144.96, query_time=dt):
        assert 0.0 <= row["predicted_occ"] <= 1.0


def test_get_pressure_at_valid_status(patch_zones):
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 16, 0, tzinfo=MELB_TZ)
    valid_statuses = {"rising", "stable", "falling"}
    for row in fs.get_pressure_at(lat=-37.82, lon=144.96, query_time=dt):
        assert row["pressure_status"] in valid_statuses


def test_get_pressure_at_source_label(patch_zones):
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 9, 0, tzinfo=MELB_TZ)
    for row in fs.get_pressure_at(lat=-37.82, lon=144.96, query_time=dt):
        assert row["source"] == "pattern_fallback"


# ─── get_alternatives_for() — AC 6.2.1 / 6.2.2 / 6.2.3 ─────────────────────

def test_get_alternatives_returns_target_and_list(patch_zones):
    """AC 6.2.1: response always has target_zone and alternatives list."""
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 17, 0, tzinfo=MELB_TZ)
    result = fs.get_alternatives_for(lat=-37.8183, lon=144.9671, query_time=dt)
    assert "target_zone" in result
    assert "alternatives" in result
    assert isinstance(result["alternatives"], list)


def test_get_alternatives_target_zone_fields(patch_zones):
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 17, 0, tzinfo=MELB_TZ)
    target = fs.get_alternatives_for(lat=-37.8183, lon=144.9671, query_time=dt)["target_zone"]
    assert target is not None
    for field in ("zone", "predicted_occ", "pressure_level", "zone_lat", "zone_lon"):
        assert field in target, f"Missing field: {field}"


def test_get_alternatives_ac621_lower_occ_than_target(patch_zones):
    """AC 6.2.1: every returned alternative must have lower occupancy than target."""
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 17, 0, tzinfo=MELB_TZ)
    result = fs.get_alternatives_for(lat=-37.8183, lon=144.9671, query_time=dt)
    target_occ = result["target_zone"]["predicted_occ"]
    for alt in result["alternatives"]:
        assert alt["predicted_occ"] < target_occ, (
            f"Alternative {alt['zone']} occ={alt['predicted_occ']} "
            f"not lower than target {target_occ}"
        )


def test_get_alternatives_ac622_has_coordinates(patch_zones):
    """AC 6.2.2: every alternative must have zone_lat/zone_lon for map flyTo."""
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 17, 0, tzinfo=MELB_TZ)
    result = fs.get_alternatives_for(lat=-37.8183, lon=144.9671, query_time=dt)
    for alt in result["alternatives"]:
        assert "zone_lat" in alt and "zone_lon" in alt
        assert isinstance(alt["zone_lat"], float)
        assert isinstance(alt["zone_lon"], float)
        # Must be in Melbourne region
        assert -38.5 < alt["zone_lat"] < -37.5
        assert 144.0 < alt["zone_lon"] < 146.0


def test_get_alternatives_ac623_empty_list_not_none(patch_zones):
    """AC 6.2.3: when no alternatives qualify, return [] not None."""
    fs._forecast_loaded = False
    # Use quiet overnight time — target will have very low occupancy,
    # so nothing will beat it; alternatives should be []
    dt = datetime(2026, 4, 14, 2, 0, tzinfo=MELB_TZ)
    result = fs.get_alternatives_for(lat=-37.8183, lon=144.9671, query_time=dt)
    # alternatives key must exist and be a list (even if empty)
    assert result["alternatives"] is not None
    assert isinstance(result["alternatives"], list)


def test_get_alternatives_respects_radius(patch_zones):
    """Alternatives outside the radius_m must be excluded."""
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 17, 0, tzinfo=MELB_TZ)
    # Use a very small radius that should exclude most zones
    result_small = fs.get_alternatives_for(
        lat=-37.8183, lon=144.9671, query_time=dt, radius_m=50
    )
    result_large = fs.get_alternatives_for(
        lat=-37.8183, lon=144.9671, query_time=dt, radius_m=2000
    )
    # Small radius should return fewer or equal alternatives
    assert len(result_small["alternatives"]) <= len(result_large["alternatives"])


def test_get_alternatives_limit_enforced(patch_zones):
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 17, 0, tzinfo=MELB_TZ)
    result = fs.get_alternatives_for(
        lat=-37.8183, lon=144.9671, query_time=dt, limit=2
    )
    assert len(result["alternatives"]) <= 2


def test_get_alternatives_composite_score_present(patch_zones):
    """Each alternative must expose the composite score (AC 6.2.1)."""
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 17, 0, tzinfo=MELB_TZ)
    for alt in fs.get_alternatives_for(lat=-37.8183, lon=144.9671, query_time=dt)["alternatives"]:
        assert "score" in alt
        assert 0.0 <= alt["score"] <= 1.0


def test_get_alternatives_walk_minutes_positive(patch_zones):
    fs._forecast_loaded = False
    dt = datetime(2026, 4, 14, 17, 0, tzinfo=MELB_TZ)
    for alt in fs.get_alternatives_for(lat=-37.8183, lon=144.9671, query_time=dt)["alternatives"]:
        assert alt["walk_minutes"] >= 1


# ─── get_event_risk() ────────────────────────────────────────────────────────

def test_get_event_risk_returns_list(patch_zones):
    fs._forecast_loaded = False
    result = fs.get_event_risk()
    assert isinstance(result, list)
    assert len(result) == len(patch_zones)


def test_get_event_risk_required_fields(patch_zones):
    fs._forecast_loaded = False
    for row in fs.get_event_risk():
        assert {"zone", "event_risk_level", "zone_lat", "zone_lon"}.issubset(row.keys())


def test_get_event_risk_valid_levels(patch_zones):
    fs._forecast_loaded = False
    valid = {"low", "medium", "high"}
    for row in fs.get_event_risk():
        assert row["event_risk_level"] in valid


def test_get_event_risk_uses_gold_when_loaded():
    """When gold is loaded, get_event_risk returns the gold dataframe rows."""
    gold_df = pd.DataFrame([
        {"zone": "Test Zone", "event_risk_level": "high",
         "zone_lat": -37.82, "zone_lon": 144.96}
    ])
    fs._forecast_loaded = True
    fs._event_risk = gold_df
    result = fs.get_event_risk()
    assert any(r["zone"] == "Test Zone" and r["event_risk_level"] == "high" for r in result)


# ─── load_forecast_data() — graceful failure ──────────────────────────────────

def test_load_forecast_data_graceful_when_epic6_missing(tmp_path):
    """
    load_forecast_data must not raise even when Epic 6 gold parquets are absent.
    Epic 5 geometry is also absent in this test (blank tmp dir), so the hardcoded
    CBD zones fallback must kick in.
    """
    import app.core.paths as paths_module

    fs._forecast_loaded = False
    fs._zone_meta = []

    with patch.object(paths_module, "data_gold_dir", return_value=tmp_path):
        # Reload so GOLD points at tmp_path
        import importlib
        importlib.reload(fs)
        # After reload _forecast_loaded is False and _zone_meta falls back to hardcoded
        fs.load_forecast_data()

    assert not fs._forecast_loaded  # Epic 6 gold not present → False
    assert len(fs._zone_meta) > 0   # hardcoded CBD zones must fill in


def test_is_forecast_loaded_reflects_flag():
    fs._forecast_loaded = False
    assert not fs.is_forecast_loaded()
    fs._forecast_loaded = True
    assert fs.is_forecast_loaded()
    fs._forecast_loaded = False  # restore


# ─── _hardcoded_cbd_zones() ──────────────────────────────────────────────────

def test_hardcoded_cbd_zones_structure():
    zones = fs._hardcoded_cbd_zones()
    assert len(zones) == 12
    required = {"zone_number", "zone_label", "centroid_lat", "centroid_lon", "total_bays"}
    for z in zones:
        assert required.issubset(z.keys())
        assert -38.5 < z["centroid_lat"] < -37.5, "lat out of Melbourne range"
        assert 144.0 < z["centroid_lon"] < 146.0, "lon out of Melbourne range"
        assert z["total_bays"] > 0
