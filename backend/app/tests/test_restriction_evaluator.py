"""Tests for the restriction evaluator (Epic 2).

Covers:
  - Legal during a timed restriction window
  - Illegal outside window / over time limit
  - Clearway-starts-mid-stay warning
  - Unknown-bay / no-data handling
  - Weekday boundary edge cases (Sun→Mon, wrap-around day ranges)
  - Multiple overlapping restrictions (strictest governs)
"""

from datetime import datetime, time, timedelta
from unittest.mock import MagicMock, patch

import pytest

from app.services.restriction_evaluator import (
    _day_in_range,
    _find_strict_starting_during_stay,
    _pick_governing_restriction,
    _to_com_day,
    evaluate_bay_at,
    evaluate_bays_bulk,
    is_restriction_active_at,
)


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_restriction(**overrides) -> MagicMock:
    """Create a mock BayRestriction with sensible defaults."""
    defaults = {
        "bay_id": "1000",
        "slot_num": 1,
        "typedesc": "2P MTR M-SAT 7:30-18:30",
        "fromday": 1,       # Mon
        "today": 6,         # Sat
        "starttime": time(7, 30),
        "endtime": time(18, 30),
        "duration_mins": 120,
        "disabilityext_mins": 240,
        "exemption": None,
        "plain_english": "Park for up to 2 hours. Pay at the parking meter.",
        "is_strict": False,
        "rule_category": "timed",
    }
    defaults.update(overrides)
    m = MagicMock()
    for k, v in defaults.items():
        setattr(m, k, v)
    return m


def _make_bay(bay_id="1000", has_data=True) -> MagicMock:
    b = MagicMock()
    b.bay_id = bay_id
    b.lat = -37.81
    b.lon = 144.96
    b.has_restriction_data = has_data
    return b


def _mock_db(bay=None, restrictions=None):
    """Return a mock Session that satisfies the evaluator's query patterns."""
    db = MagicMock()

    bay_query = MagicMock()
    bay_filt = MagicMock()
    bay_filt.first.return_value = bay
    bay_filt.all.return_value = [bay] if bay is not None else []
    bay_query.filter.return_value = bay_filt

    restriction_query = MagicMock()
    restriction_query.filter.return_value.all.return_value = restrictions or []

    def query_side_effect(model):
        from app.models.bay import Bay, BayRestriction
        if model is Bay:
            return bay_query
        if model is BayRestriction:
            return restriction_query
        return MagicMock()

    db.query.side_effect = query_side_effect
    return db


# ═══════════════════════════════════════════════════════════════════════════
# _to_com_day
# ═══════════════════════════════════════════════════════════════════════════

class TestToComDay:
    def test_monday(self):
        assert _to_com_day(datetime(2026, 4, 13, 10, 0)) == 1   # Mon

    def test_sunday(self):
        assert _to_com_day(datetime(2026, 4, 12, 10, 0)) == 0   # Sun

    def test_saturday(self):
        assert _to_com_day(datetime(2026, 4, 18, 10, 0)) == 6   # Sat


# ═══════════════════════════════════════════════════════════════════════════
# _day_in_range (including wrap-around)
# ═══════════════════════════════════════════════════════════════════════════

class TestDayInRange:
    def test_normal_range(self):
        assert _day_in_range(3, 1, 5) is True    # Wed in Mon–Fri

    def test_normal_range_boundary(self):
        assert _day_in_range(1, 1, 5) is True    # Mon in Mon–Fri
        assert _day_in_range(5, 1, 5) is True    # Fri in Mon–Fri

    def test_normal_range_outside(self):
        assert _day_in_range(0, 1, 5) is False   # Sun not in Mon–Fri
        assert _day_in_range(6, 1, 5) is False   # Sat not in Mon–Fri

    def test_wrap_around_sat_sun(self):
        # SAT(6)–SUN(0): fromday=6, today=0
        assert _day_in_range(6, 6, 0) is True    # Sat ✓
        assert _day_in_range(0, 6, 0) is True    # Sun ✓
        assert _day_in_range(3, 6, 0) is False   # Wed ✗

    def test_wrap_around_fri_mon(self):
        # FRI(5)–MON(1): fromday=5, today=1
        assert _day_in_range(5, 5, 1) is True    # Fri ✓
        assert _day_in_range(6, 5, 1) is True    # Sat ✓
        assert _day_in_range(0, 5, 1) is True    # Sun ✓
        assert _day_in_range(1, 5, 1) is True    # Mon ✓
        assert _day_in_range(3, 5, 1) is False   # Wed ✗

    def test_single_day(self):
        assert _day_in_range(3, 3, 3) is True    # Wed == Wed
        assert _day_in_range(4, 3, 3) is False


# ═══════════════════════════════════════════════════════════════════════════
# is_restriction_active_at
# ═══════════════════════════════════════════════════════════════════════════

class TestIsRestrictionActiveAt:
    def test_active_during_window(self):
        r = _make_restriction(fromday=1, today=5, starttime=time(7, 30), endtime=time(18, 30))
        dt = datetime(2026, 4, 14, 10, 0)  # Tue 10:00
        assert is_restriction_active_at(r, dt) is True

    def test_inactive_outside_time(self):
        r = _make_restriction(fromday=1, today=5, starttime=time(7, 30), endtime=time(18, 30))
        dt = datetime(2026, 4, 14, 19, 0)  # Tue 19:00 (after endtime)
        assert is_restriction_active_at(r, dt) is False

    def test_inactive_wrong_day(self):
        r = _make_restriction(fromday=1, today=5, starttime=time(7, 30), endtime=time(18, 30))
        dt = datetime(2026, 4, 12, 10, 0)  # Sun
        assert is_restriction_active_at(r, dt) is False

    def test_endtime_exclusive(self):
        r = _make_restriction(fromday=1, today=5, starttime=time(7, 30), endtime=time(18, 30))
        dt = datetime(2026, 4, 14, 18, 30)  # exactly at endtime
        assert is_restriction_active_at(r, dt) is False

    def test_starttime_inclusive(self):
        r = _make_restriction(fromday=1, today=5, starttime=time(7, 30), endtime=time(18, 30))
        dt = datetime(2026, 4, 14, 7, 30)  # exactly at starttime
        assert is_restriction_active_at(r, dt) is True

    def test_wrap_around_day_range(self):
        # SAT-SUN restriction
        r = _make_restriction(fromday=6, today=0, starttime=time(7, 30), endtime=time(22, 0))
        sat = datetime(2026, 4, 18, 10, 0)   # Sat
        sun = datetime(2026, 4, 19, 10, 0)   # Sun
        wed = datetime(2026, 4, 15, 10, 0)   # Wed
        assert is_restriction_active_at(r, sat) is True
        assert is_restriction_active_at(r, sun) is True
        assert is_restriction_active_at(r, wed) is False


# ═══════════════════════════════════════════════════════════════════════════
# evaluate_bay_at — full integration-style tests
# ═══════════════════════════════════════════════════════════════════════════

class TestEvaluateBayAt:
    def test_unknown_bay(self):
        db = _mock_db(bay=None)
        result = evaluate_bay_at("9999", datetime.now(), 60, db)
        assert result["verdict"] == "unknown"
        assert "not found" in result["reason"].lower()

    def test_no_restriction_data(self):
        bay = _make_bay(has_data=False)
        db = _mock_db(bay=bay, restrictions=[])
        result = evaluate_bay_at("1000", datetime.now(), 60, db)
        assert result["verdict"] == "unknown"
        assert "signage" in result["reason"].lower()

    def test_legal_during_timed_window(self):
        bay = _make_bay()
        r = _make_restriction(
            duration_mins=120,
            rule_category="timed",
            is_strict=False,
        )
        db = _mock_db(bay=bay, restrictions=[r])
        # Tue 10:00, stay 60 min — within 2h limit
        result = evaluate_bay_at("1000", datetime(2026, 4, 14, 10, 0), 60, db)
        assert result["verdict"] == "yes"
        assert result["active_restriction"] is not None
        assert result["active_restriction"]["max_stay_mins"] == 120

    def test_illegal_overstay(self):
        bay = _make_bay()
        r = _make_restriction(
            duration_mins=60,
            rule_category="timed",
            is_strict=False,
            plain_english="Park for up to 1 hour.",
        )
        db = _mock_db(bay=bay, restrictions=[r])
        # Tue 10:00, plan to stay 90 min — over 1h limit
        result = evaluate_bay_at("1000", datetime(2026, 4, 14, 10, 0), 90, db)
        assert result["verdict"] == "no"
        assert "90 min" in result["reason"]
        assert "60 min" in result["reason"]

    def test_no_restriction_active_means_free(self):
        bay = _make_bay()
        r = _make_restriction(
            fromday=1, today=5,
            starttime=time(7, 30), endtime=time(18, 30),
            rule_category="loading",
        )
        db = _mock_db(bay=bay, restrictions=[r])
        # Sun 10:00 — no restriction active
        result = evaluate_bay_at("1000", datetime(2026, 4, 12, 10, 0), 60, db)
        assert result["verdict"] == "yes"
        assert result["active_restriction"] is None
        assert "free of charge" not in result["reason"].lower()
        assert "posted signage" in result["reason"].lower()

    def test_no_restriction_active_timed_bay_outside_meter_hours(self):
        """Outside paid hours for a metered bay — do not imply unconditional free parking."""
        bay = _make_bay()
        r = _make_restriction(
            fromday=1, today=5,
            starttime=time(7, 30), endtime=time(18, 30),
            rule_category="timed",
            plain_english="Park for up to 2 hours. Pay at the meter.",
        )
        db = _mock_db(bay=bay, restrictions=[r])
        result = evaluate_bay_at("1000", datetime(2026, 4, 14, 20, 0), 60, db)
        assert result["verdict"] == "yes"
        assert result["active_restriction"] is None
        assert "meter" in result["reason"].lower()
        assert "free of charge" not in result["reason"].lower()

    def test_clearway_always_no(self):
        bay = _make_bay()
        r = _make_restriction(
            typedesc="NO STOPPING M-F 4:30PM-6:30PM",
            fromday=1, today=5,
            starttime=time(16, 30), endtime=time(18, 30),
            is_strict=True,
            rule_category="clearway",
            plain_english="No stopping — tow-away zone.",
        )
        db = _mock_db(bay=bay, restrictions=[r])
        # Tue 17:00 — clearway active
        result = evaluate_bay_at("1000", datetime(2026, 4, 14, 17, 0), 30, db)
        assert result["verdict"] == "no"
        assert result["active_restriction"]["rule_category"] == "clearway"

    def test_free_category_yes(self):
        bay = _make_bay()
        r = _make_restriction(
            typedesc="FREE",
            fromday=0, today=6,
            starttime=time(0, 0), endtime=time(23, 59),
            is_strict=False,
            rule_category="free",
            plain_english="Free parking.",
            duration_mins=None,
        )
        db = _mock_db(bay=bay, restrictions=[r])
        result = evaluate_bay_at("1000", datetime(2026, 4, 14, 12, 0), 120, db)
        assert result["verdict"] == "yes"

    def test_disabled_bay_no_for_general_driver(self):
        bay = _make_bay()
        r = _make_restriction(
            typedesc="DIS ONLY",
            fromday=1, today=6,
            starttime=time(7, 30), endtime=time(18, 30),
            is_strict=False,
            rule_category="disabled",
            plain_english="Disability parking permit required.",
        )
        db = _mock_db(bay=bay, restrictions=[r])
        result = evaluate_bay_at("1000", datetime(2026, 4, 14, 10, 0), 60, db)
        assert result["verdict"] == "no"


# ═══════════════════════════════════════════════════════════════════════════
# Mid-stay strict-restriction warnings
# ═══════════════════════════════════════════════════════════════════════════

class TestMidStayWarning:
    def test_clearway_starts_mid_stay(self):
        bay = _make_bay()
        timed = _make_restriction(
            typedesc="2P MTR M-F 7:30-16:30",
            fromday=1, today=5,
            starttime=time(7, 30), endtime=time(16, 30),
            duration_mins=120,
            is_strict=False,
            rule_category="timed",
        )
        clearway = _make_restriction(
            typedesc="NO STOPPING M-F 4:30PM-6:30PM",
            fromday=1, today=5,
            starttime=time(16, 30), endtime=time(18, 30),
            is_strict=True,
            rule_category="clearway",
            plain_english="No stopping — tow-away zone.",
        )
        db = _mock_db(bay=bay, restrictions=[timed, clearway])
        # Tue 15:00, stay 120 min → until 17:00, clearway starts at 16:30
        result = evaluate_bay_at("1000", datetime(2026, 4, 14, 15, 0), 120, db)
        assert result["verdict"] == "yes"
        assert result["warning"] is not None
        assert result["warning"]["type"] == "clearway"
        assert result["warning"]["minutes_into_stay"] == 90

    def test_no_warning_when_stay_ends_before_strict(self):
        bay = _make_bay()
        timed = _make_restriction(
            fromday=1, today=5,
            starttime=time(7, 30), endtime=time(18, 30),
            duration_mins=120,
        )
        clearway = _make_restriction(
            typedesc="CLEARWAY",
            fromday=1, today=5,
            starttime=time(18, 30), endtime=time(20, 0),
            is_strict=True,
            rule_category="clearway",
            plain_english="Clearway.",
        )
        db = _mock_db(bay=bay, restrictions=[timed, clearway])
        # Tue 10:00, stay 60 min → until 11:00, clearway at 18:30 — no warning
        result = evaluate_bay_at("1000", datetime(2026, 4, 14, 10, 0), 60, db)
        assert result["warning"] is None


# ═══════════════════════════════════════════════════════════════════════════
# Strictest-restriction-governs logic
# ═══════════════════════════════════════════════════════════════════════════

class TestGoverningRestriction:
    def test_clearway_beats_timed(self):
        clearway = _make_restriction(rule_category="clearway", is_strict=True)
        timed = _make_restriction(rule_category="timed", is_strict=False)
        assert _pick_governing_restriction([timed, clearway]).rule_category == "clearway"

    def test_loading_beats_timed(self):
        loading = _make_restriction(rule_category="loading", is_strict=True)
        timed = _make_restriction(rule_category="timed", is_strict=False)
        assert _pick_governing_restriction([timed, loading]).rule_category == "loading"

    def test_empty_returns_none(self):
        assert _pick_governing_restriction([]) is None


# ═══════════════════════════════════════════════════════════════════════════
# Cross-midnight / weekday boundary
# ═══════════════════════════════════════════════════════════════════════════

class TestWeekdayBoundary:
    def test_sunday_to_monday_overnight(self):
        """Stay starts Sunday evening; clearway starts Monday morning."""
        clearway = _make_restriction(
            typedesc="CLEARWAY M-F 7:30AM-9:30AM",
            fromday=1, today=5,
            starttime=time(7, 30), endtime=time(9, 30),
            is_strict=True,
            rule_category="clearway",
            plain_english="Clearway.",
        )
        # Sun 23:00, stay 10 hours → ends Mon 09:00
        arrival = datetime(2026, 4, 12, 23, 0)
        warning = _find_strict_starting_during_stay([clearway], arrival, 600)
        assert warning is not None
        assert warning["type"] == "clearway"

    def test_clearway_does_not_trigger_on_wrong_day(self):
        """Clearway only on Mon–Fri; stay is Sat night into Sun."""
        clearway = _make_restriction(
            fromday=1, today=5,
            starttime=time(7, 30), endtime=time(9, 30),
            is_strict=True,
            rule_category="clearway",
            plain_english="Clearway.",
        )
        # Sat 22:00, stay 12 hours → ends Sun 10:00
        arrival = datetime(2026, 4, 18, 22, 0)
        warning = _find_strict_starting_during_stay([clearway], arrival, 720)
        assert warning is None


# ═══════════════════════════════════════════════════════════════════════════
# Bulk evaluation + API cache fallback (parity with evaluate_bay_at)
# ═══════════════════════════════════════════════════════════════════════════


class TestEvaluateBaysBulk:
    @patch("app.services.restriction_lookup_service.get_cached_bay_type")
    def test_fallback_when_no_restriction_rows_uses_cached_bay_type(self, mock_bay_type):
        mock_bay_type.return_value = "Loading Zone"
        bay = _make_bay(has_data=True)
        db = _mock_db(bay=bay, restrictions=[])
        out = evaluate_bays_bulk(["1000"], datetime(2026, 4, 14, 12, 0), 60, db)
        assert len(out) == 1
        assert out[0]["verdict"] == "no"

    @patch("app.services.restriction_lookup_service.get_cached_bay_type")
    def test_fallback_when_has_restriction_data_false(self, mock_bay_type):
        mock_bay_type.return_value = "Loading Zone"
        bay = _make_bay(has_data=False)
        db = _mock_db(bay=bay, restrictions=[])
        out = evaluate_bays_bulk(["1000"], datetime(2026, 4, 14, 12, 0), 60, db)
        assert len(out) == 1
        assert out[0]["verdict"] == "no"
