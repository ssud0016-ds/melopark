"""Tests for ``scripts.build_gold.classify_rule``.

Focus of this suite: Bug 7 — ``disabled`` rules must classify as strict so the
evaluator's mid-stay warning path fires when a disabled window activates
during a driver's stay.

Regression coverage also pins the other strict / non-strict categories so the
fix doesn't inadvertently reorder the regex cascade.
"""

from __future__ import annotations

import pytest

from scripts.build_gold import classify_rule


class TestDisabledIsStrict:
    """Bug 7: disabled-bay rules must be classified as strict."""

    @pytest.mark.parametrize(
        "typedesc",
        [
            "2P DIS M-SAT",
            "P DIS AOT",
            "2PDis AOT",
            "DISABILITY",
            "Disabled Only",
            "DISABLE",
            "DIS",
        ],
    )
    def test_disabled_patterns_are_strict(self, typedesc: str) -> None:
        is_strict, category = classify_rule(typedesc)
        assert category == "disabled", (
            f"Expected disabled classification for '{typedesc}', got '{category}'"
        )
        assert is_strict is True, (
            f"Expected is_strict=True for disabled rule '{typedesc}' "
            f"(Bug 7 — a non-permitted driver is illegally parked so the "
            f"mid-stay warning path must fire)."
        )


class TestClassifyRuleRegression:
    """Pin behaviour of the other categories so the Bug 7 fix doesn't drift."""

    @pytest.mark.parametrize(
        "typedesc,expected_category",
        [
            ("CW TOW M-F 16:00-19:00", "clearway"),
            ("CLEARWAY", "clearway"),
            ("No Stop M-F 7.00-09.30", "no_standing"),
            ("NO PARKING", "no_standing"),
            ("LZ 30MINS", "loading"),
            ("L/ZONE 60MINS", "loading"),
            ("LOADING ZONE", "loading"),
        ],
    )
    def test_strict_categories_remain_strict(
        self, typedesc: str, expected_category: str
    ) -> None:
        is_strict, category = classify_rule(typedesc)
        assert category == expected_category
        assert is_strict is True

    @pytest.mark.parametrize(
        "typedesc,expected_category",
        [
            ("2P MTR", "timed"),
            ("1P", "timed"),
            ("4P MTR", "timed"),
            ("1/2P", "timed"),
            ("P 15MINS", "timed"),
            ("METER", "timed"),
            ("BUS ZONE", "other"),
            ("TAXI", "other"),
            ("PERMIT ZONE", "other"),
            ("", "other"),
        ],
    )
    def test_non_strict_categories_remain_non_strict(
        self, typedesc: str, expected_category: str
    ) -> None:
        is_strict, category = classify_rule(typedesc)
        assert category == expected_category
        assert is_strict is False

    def test_none_and_nan_inputs(self) -> None:
        assert classify_rule(None) == (False, "other")  # type: ignore[arg-type]
        assert classify_rule("") == (False, "other")

    def test_lz_30mins_hits_loading_not_timed(self) -> None:
        """Regression guard for the regex cascade ordering."""
        is_strict, category = classify_rule("LZ 30MINS")
        assert category == "loading"
        assert is_strict is True
