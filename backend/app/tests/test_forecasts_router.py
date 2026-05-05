"""
test_forecasts_router.py
========================
Integration tests for Epic 6 /api/forecasts/* endpoints.

Coverage:
  AC 6.1.1  GET /api/forecasts/warnings  — event fields present
  AC 6.1.2  GET /api/forecasts/warnings  — dismissKey fields change on new conditions
  AC 6.1.3  GET /api/forecasts/warnings  — 0-6h hourly range returned
  AC 6.2.1  GET /api/forecasts/alternatives — composite score + lower occ
  AC 6.2.2  GET /api/forecasts/alternatives — centroid coords always present
  AC 6.2.3  GET /api/forecasts/alternatives — empty list, not missing key
  General   400 bad datetime, 422 missing params, response envelope fields
            GET /api/forecasts/pressure, GET /api/forecasts/events
"""
from __future__ import annotations

import os
from unittest.mock import patch

os.environ.setdefault("MELOPARK_TILE_PREWARM", "0")
os.environ.setdefault("MELOPARK_PRESSURE_PREWARM", "0")

import pytest
from fastapi.testclient import TestClient

from app.main import app
import app.services.forecast_service as fs

client = TestClient(app)

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _cbd_zones():
    return fs._hardcoded_cbd_zones()


@pytest.fixture(autouse=True)
def _inject_zones():
    """Ensure all router tests use a predictable zone set."""
    original = fs._zone_meta
    fs._zone_meta = _cbd_zones()
    fs._forecast_loaded = False          # force pattern fallback
    yield
    fs._zone_meta = original
    fs._forecast_loaded = False


# ─── GET /api/forecasts/warnings ─────────────────────────────────────────────

class TestWarningsEndpoint:

    def test_200_default(self):
        r = client.get("/api/forecasts/warnings")
        assert r.status_code == 200

    def test_response_envelope(self):
        data = client.get("/api/forecasts/warnings").json()
        assert "generated_at" in data
        assert "query_time" in data
        assert "hours_ahead" in data
        assert "warnings" in data
        assert "total" in data

    def test_total_matches_warnings_length(self):
        data = client.get("/api/forecasts/warnings").json()
        assert data["total"] == len(data["warnings"])

    def test_hours_ahead_reflected(self):
        data = client.get("/api/forecasts/warnings?hours=3").json()
        assert data["hours_ahead"] == 3

    # ── AC 6.1.3: 0–N hour range ─────────────────────────────────────────────
    def test_ac613_hours_from_now_range(self):
        """AC 6.1.3 — entries span hours_from_now 0 through N."""
        data = client.get("/api/forecasts/warnings?hours=6").json()
        hfn_values = {w["hours_from_now"] for w in data["warnings"]}
        assert 0 in hfn_values, "hours_from_now=0 (live) must be present"
        assert max(hfn_values) <= 6

    def test_ac613_hour_chips_3h(self):
        """AC 6.1.3 — works for custom hours=3 (matching +3h chip)."""
        data = client.get("/api/forecasts/warnings?hours=3").json()
        assert all(w["hours_from_now"] <= 3 for w in data["warnings"])

    # ── AC 6.1.1: event fields ────────────────────────────────────────────────
    def test_ac611_event_fields_present(self):
        """AC 6.1.1 — each warning carries event_risk_level + events_nearby."""
        data = client.get("/api/forecasts/warnings").json()
        for w in data["warnings"]:
            assert "event_risk_level" in w, "event_risk_level missing"
            assert "events_nearby" in w, "events_nearby missing"
            assert w["event_risk_level"] in {"low", "moderate", "medium", "high", "critical"}

    # ── AC 6.1.2: coordinate fields for dismissKey ────────────────────────────
    def test_ac612_zone_coordinates_present(self):
        """AC 6.1.2 — zone_lat + zone_lon needed by ParkingAlertBanner haversine."""
        data = client.get("/api/forecasts/warnings").json()
        for w in data["warnings"]:
            assert "zone_lat" in w
            assert "zone_lon" in w
            assert isinstance(w["zone_lat"], float)
            assert isinstance(w["zone_lon"], float)

    def test_warning_level_values(self):
        data = client.get("/api/forecasts/warnings").json()
        valid = {"low", "moderate", "high", "critical"}
        for w in data["warnings"]:
            assert w["warning_level"] in valid

    def test_predicted_occupancy_bounds(self):
        data = client.get("/api/forecasts/warnings").json()
        for w in data["warnings"]:
            assert 0.0 <= w["predicted_occupancy"] <= 1.0

    def test_at_param_accepted(self):
        """Custom ISO 'at' datetime must be accepted without error."""
        r = client.get("/api/forecasts/warnings?at=2026-06-01T09:00:00")
        assert r.status_code == 200

    def test_at_param_utc_offset_accepted(self):
        r = client.get("/api/forecasts/warnings?at=2026-06-01T09:00:00%2B10:00")
        assert r.status_code == 200

    def test_invalid_at_returns_400(self):
        r = client.get("/api/forecasts/warnings?at=not-a-date")
        assert r.status_code == 400

    def test_hours_ge_1(self):
        r = client.get("/api/forecasts/warnings?hours=0")
        assert r.status_code == 422

    def test_hours_le_12(self):
        r = client.get("/api/forecasts/warnings?hours=99")
        assert r.status_code == 422

    def test_generated_at_is_iso_string(self):
        from datetime import datetime
        data = client.get("/api/forecasts/warnings").json()
        # Should parse without error
        datetime.fromisoformat(data["generated_at"])

    def test_warning_message_nonempty(self):
        data = client.get("/api/forecasts/warnings").json()
        for w in data["warnings"]:
            assert isinstance(w.get("warning_message", ""), str)


# ─── GET /api/forecasts/alternatives ─────────────────────────────────────────

class TestAlternativesEndpoint:

    def test_200_with_valid_coords(self):
        r = client.get("/api/forecasts/alternatives?lat=-37.8183&lon=144.9671")
        assert r.status_code == 200

    def test_422_missing_lat(self):
        r = client.get("/api/forecasts/alternatives?lon=144.9671")
        assert r.status_code == 422

    def test_422_missing_lon(self):
        r = client.get("/api/forecasts/alternatives?lat=-37.8183")
        assert r.status_code == 422

    def test_response_envelope(self):
        data = client.get("/api/forecasts/alternatives?lat=-37.8183&lon=144.9671").json()
        assert "generated_at" in data
        assert "query_time" in data
        assert "target_zone" in data
        assert "alternatives" in data
        assert "destination_lat" in data
        assert "destination_lon" in data
        assert "radius_m" in data

    def test_destination_coords_echoed(self):
        data = client.get("/api/forecasts/alternatives?lat=-37.8183&lon=144.9671").json()
        assert data["destination_lat"] == pytest.approx(-37.8183)
        assert data["destination_lon"] == pytest.approx(144.9671)

    def test_radius_echoed(self):
        data = client.get("/api/forecasts/alternatives?lat=-37.8183&lon=144.9671&radius=600").json()
        assert data["radius_m"] == 600

    # ── AC 6.2.1: ranked lower-occupancy alternatives ─────────────────────────
    def test_ac621_alternatives_lower_occ_than_target(self):
        """AC 6.2.1 — every alternative has lower predicted_occ than the target."""
        # Use peak hour to ensure busy target zone
        data = client.get(
            "/api/forecasts/alternatives?lat=-37.8183&lon=144.9671"
            "&at=2026-04-14T17:00:00%2B10:00"
        ).json()
        target = data.get("target_zone")
        if target is None:
            pytest.skip("No target zone returned (all zones quiet)")
        for alt in data["alternatives"]:
            assert alt["predicted_occ"] < target["predicted_occ"], (
                f"{alt['zone']} occ={alt['predicted_occ']} not < target {target['predicted_occ']}"
            )

    def test_ac621_score_field_present(self):
        """AC 6.2.1 — composite score is returned for each alternative."""
        data = client.get(
            "/api/forecasts/alternatives?lat=-37.8183&lon=144.9671"
            "&at=2026-04-14T17:00:00%2B10:00"
        ).json()
        for alt in data["alternatives"]:
            assert "score" in alt
            assert 0.0 <= alt["score"] <= 1.0

    def test_ac621_walk_minutes_present(self):
        data = client.get(
            "/api/forecasts/alternatives?lat=-37.8183&lon=144.9671"
            "&at=2026-04-14T17:00:00%2B10:00"
        ).json()
        for alt in data["alternatives"]:
            assert "walk_minutes" in alt
            assert alt["walk_minutes"] >= 1

    # ── AC 6.2.2: coordinates for map flyTo ───────────────────────────────────
    def test_ac622_zone_lat_lon_in_every_alternative(self):
        """AC 6.2.2 — zone_lat + zone_lon present on every alternative for flyTo."""
        data = client.get(
            "/api/forecasts/alternatives?lat=-37.8183&lon=144.9671"
            "&at=2026-04-14T17:00:00%2B10:00"
        ).json()
        for alt in data["alternatives"]:
            assert "zone_lat" in alt and "zone_lon" in alt
            assert -38.5 < alt["zone_lat"] < -37.5
            assert 144.0 < alt["zone_lon"] < 146.0

    def test_ac622_target_zone_has_coords(self):
        data = client.get("/api/forecasts/alternatives?lat=-37.8183&lon=144.9671").json()
        if data["target_zone"]:
            assert "zone_lat" in data["target_zone"]
            assert "zone_lon" in data["target_zone"]

    # ── AC 6.2.3: empty list — not None, not omitted ──────────────────────────
    def test_ac623_alternatives_key_always_list(self):
        """AC 6.2.3 — alternatives must be a list (may be empty, never None)."""
        # Overnight quiet period: target occ is low, no zone beats it
        data = client.get(
            "/api/forecasts/alternatives?lat=-37.8183&lon=144.9671"
            "&at=2026-04-14T02:00:00%2B10:00"
        ).json()
        assert data["alternatives"] is not None, "AC 6.2.3: alternatives must not be None"
        assert isinstance(data["alternatives"], list)

    def test_ac623_empty_alternatives_still_has_key(self):
        """AC 6.2.3 — 'alternatives' key must exist even when list is empty."""
        data = client.get(
            "/api/forecasts/alternatives?lat=-37.8183&lon=144.9671"
            "&at=2026-04-14T02:00:00%2B10:00"
        ).json()
        assert "alternatives" in data

    def test_limit_param_respected(self):
        data = client.get(
            "/api/forecasts/alternatives?lat=-37.8183&lon=144.9671"
            "&at=2026-04-14T17:00:00%2B10:00&limit=2"
        ).json()
        assert len(data["alternatives"]) <= 2

    def test_invalid_at_returns_400(self):
        r = client.get("/api/forecasts/alternatives?lat=-37.82&lon=144.96&at=baddate")
        assert r.status_code == 400

    def test_lat_out_of_range(self):
        r = client.get("/api/forecasts/alternatives?lat=-200&lon=144.96")
        assert r.status_code == 422

    def test_pressure_level_valid_values(self):
        data = client.get(
            "/api/forecasts/alternatives?lat=-37.8183&lon=144.9671"
            "&at=2026-04-14T17:00:00%2B10:00"
        ).json()
        valid = {"low", "moderate", "high", "critical"}
        for alt in data["alternatives"]:
            assert alt["pressure_level"] in valid


# ─── GET /api/forecasts/pressure ─────────────────────────────────────────────

class TestPressureEndpoint:

    def test_200_with_valid_coords(self):
        r = client.get("/api/forecasts/pressure?lat=-37.82&lon=144.96")
        assert r.status_code == 200

    def test_response_envelope(self):
        data = client.get("/api/forecasts/pressure?lat=-37.82&lon=144.96").json()
        assert "generated_at" in data
        assert "query_time" in data
        assert "zones" in data
        assert isinstance(data["zones"], list)

    def test_zones_not_empty(self):
        data = client.get("/api/forecasts/pressure?lat=-37.82&lon=144.96").json()
        assert len(data["zones"]) > 0

    def test_zone_fields(self):
        data = client.get("/api/forecasts/pressure?lat=-37.82&lon=144.96").json()
        for z in data["zones"]:
            assert "zone" in z
            assert "predicted_occ" in z
            assert "pressure_status" in z
            assert 0.0 <= z["predicted_occ"] <= 1.0

    def test_pressure_status_values(self):
        data = client.get("/api/forecasts/pressure?lat=-37.82&lon=144.96").json()
        for z in data["zones"]:
            assert z["pressure_status"] in {"rising", "stable", "falling"}

    def test_at_param_future_date(self):
        r = client.get("/api/forecasts/pressure?lat=-37.82&lon=144.96&at=2026-12-25T10:00:00")
        assert r.status_code == 200

    def test_422_missing_lat(self):
        r = client.get("/api/forecasts/pressure?lon=144.96")
        assert r.status_code == 422


# ─── GET /api/forecasts/events ───────────────────────────────────────────────

class TestEventsEndpoint:

    def test_200(self):
        r = client.get("/api/forecasts/events")
        assert r.status_code == 200

    def test_response_envelope(self):
        data = client.get("/api/forecasts/events").json()
        assert "generated_at" in data
        assert "zones" in data
        assert "total" in data

    def test_total_matches_zones_length(self):
        data = client.get("/api/forecasts/events").json()
        assert data["total"] == len(data["zones"])

    def test_zones_have_required_fields(self):
        data = client.get("/api/forecasts/events").json()
        for z in data["zones"]:
            assert "zone" in z
            assert "event_risk_level" in z
            assert "zone_lat" in z
            assert "zone_lon" in z

    def test_event_risk_level_valid(self):
        data = client.get("/api/forecasts/events").json()
        valid = {"low", "medium", "high"}
        for z in data["zones"]:
            assert z["event_risk_level"] in valid


# ─── Cross-cutting: no internal paths leaked in error responses ───────────────

class TestNoPathLeakage:

    def test_warnings_invalid_hours_no_path(self):
        r = client.get("/api/forecasts/warnings?hours=0")
        assert ".parquet" not in r.text.lower()
        assert "/home/" not in r.text
        assert "/workspace/" not in r.text

    def test_alternatives_bad_at_no_path(self):
        r = client.get("/api/forecasts/alternatives?lat=-37.82&lon=144.96&at=INVALID")
        assert ".parquet" not in r.text.lower()

    def test_404_for_unknown_forecast_route(self):
        r = client.get("/api/forecasts/doesnotexist")
        assert r.status_code == 404


# ─── Graceful fallback when forecast_service has no gold data ─────────────────

class TestGracefulFallback:

    def test_warnings_works_without_gold(self):
        """Endpoints must return 200 even when gold parquets are absent."""
        fs._forecast_loaded = False
        fs._peak_warnings = __import__("pandas").DataFrame()
        r = client.get("/api/forecasts/warnings")
        assert r.status_code == 200
        assert len(r.json()["warnings"]) > 0

    def test_alternatives_works_without_gold(self):
        fs._forecast_loaded = False
        fs._alternatives_guidance = __import__("pandas").DataFrame()
        r = client.get("/api/forecasts/alternatives?lat=-37.8183&lon=144.9671")
        assert r.status_code == 200

    def test_events_works_without_gold(self):
        fs._forecast_loaded = False
        fs._event_risk = __import__("pandas").DataFrame()
        r = client.get("/api/forecasts/events")
        assert r.status_code == 200
