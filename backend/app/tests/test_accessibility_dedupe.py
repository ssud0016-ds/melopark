"""Dedupe logic for /api/accessibility/all matches legacy sort + drop_duplicates."""

import pandas as pd

from app.services.accessibility_service import _dedupe_best_row_per_bay_id


def test_dedupe_prefers_active_then_available() -> None:
    df = pd.DataFrame(
        {
            "bay_id": [1, 1, 1],
            "is_active_now": [False, True, False],
            "is_available_now": [True, True, False],
            "lat": [-37.0, -37.0, -37.0],
            "lon": [144.96, 144.96, 144.96],
        }
    )
    legacy = df.sort_values(
        ["is_active_now", "is_available_now"],
        ascending=[False, False],
    ).drop_duplicates(subset=["bay_id"], keep="first")
    scored = _dedupe_best_row_per_bay_id(df)
    assert len(scored) == len(legacy) == 1
    assert scored.iloc[0]["is_active_now"] == legacy.iloc[0]["is_active_now"]
    assert scored.iloc[0]["is_available_now"] == legacy.iloc[0]["is_available_now"]


def test_dedupe_matches_legacy_when_only_available_column() -> None:
    df = pd.DataFrame(
        {
            "bay_id": [1, 1],
            "is_available_now": [False, True],
            "lat": [-37.0, -37.0],
            "lon": [144.96, 144.96],
        }
    )
    legacy = df.sort_values(["is_available_now"], ascending=[False]).drop_duplicates(
        subset=["bay_id"],
        keep="first",
    )
    scored = _dedupe_best_row_per_bay_id(df)
    assert len(scored) == 1
    assert bool(scored.iloc[0]["is_available_now"]) is True
    assert bool(scored.iloc[0]["is_available_now"]) == bool(legacy.iloc[0]["is_available_now"])
