"""Unit tests for LZ/DP uniform-segment restriction helpers (Bug 1 / Phase A)."""

import pandas as pd

from scripts.clean_to_silver import (
    SEGMENT_EXCLUDE_PREFIXES,
    _compute_segment_is_uniform_lz_dp,
    _parkingzone_is_uniform_lz_dp,
)


def test_parkingzone_uniform_only_lz_dp() -> None:
    signs = pd.DataFrame(
        {
            "parkingzone": ["Z1", "Z1", "Z2", "Z2"],
            "display_code": ["LZ30", "DP5", "LZ30", "MP2P"],
        }
    )
    g1 = signs[signs["parkingzone"] == "Z1"]
    g2 = signs[signs["parkingzone"] == "Z2"]
    assert _parkingzone_is_uniform_lz_dp(g1) is True
    assert _parkingzone_is_uniform_lz_dp(g2) is False


def test_parkingzone_uniform_empty_false() -> None:
    assert _parkingzone_is_uniform_lz_dp(pd.DataFrame({"parkingzone": [], "display_code": []})) is False


def test_segment_uniform_requires_all_zones_lz_dp_only() -> None:
    signs = pd.DataFrame(
        {
            "parkingzone": ["A", "B"],
            "display_code": ["LZ30", "MP2P"],
        }
    )
    zones = pd.DataFrame(
        {
            "segment_id": ["S1", "S1"],
            "parkingzone": ["A", "B"],
        }
    )
    seg_u = _compute_segment_is_uniform_lz_dp(signs, zones)
    assert bool(seg_u.loc["S1"]) is False


def test_segment_uniform_all_lz_dp_zones() -> None:
    signs = pd.DataFrame(
        {
            "parkingzone": ["A", "B", "B"],
            "display_code": ["DP1", "LZ30", "LZ20"],
        }
    )
    zones = pd.DataFrame(
        {
            "segment_id": ["S1", "S1"],
            "parkingzone": ["A", "B"],
        }
    )
    seg_u = _compute_segment_is_uniform_lz_dp(signs, zones)
    assert bool(seg_u.loc["S1"]) is True


def test_segment_exclude_prefixes_tuple() -> None:
    assert SEGMENT_EXCLUDE_PREFIXES == ("LZ", "DP")

