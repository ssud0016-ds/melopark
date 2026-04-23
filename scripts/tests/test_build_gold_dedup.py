from pathlib import Path

import pandas as pd

from scripts.build_gold import dedup_restrictions_for_db, parse_time_value


def test_dedup_preserves_time_windows() -> None:
    df = pd.DataFrame(
        [
            {
                "bay_id": "57923",
                "slot_num": 1,
                "typedesc": "2P MTR",
                "fromday": 6,
                "today": 0,
                "starttime": parse_time_value("07:00"),
                "endtime": parse_time_value("22:00"),
            },
            {
                "bay_id": "57923",
                "slot_num": 2,
                "typedesc": "2P MTR",
                "fromday": 1,
                "today": 5,
                "starttime": parse_time_value("09:30"),
                "endtime": parse_time_value("16:00"),
            },
            # True duplicate of the first row should be removed.
            {
                "bay_id": "57923",
                "slot_num": 1,
                "typedesc": "2P MTR",
                "fromday": 6,
                "today": 0,
                "starttime": parse_time_value("07:00"),
                "endtime": parse_time_value("22:00"),
            },
        ]
    )

    out = dedup_restrictions_for_db(df)
    assert len(out) == 2
    assert set(out["slot_num"].tolist()) == {1, 2}


def test_bay_57923_fixture_has_weekday_and_weekend_windows() -> None:
    root = Path(__file__).resolve().parents[2]
    seg_path = root / "data" / "silver" / "segment_restrictions_long.parquet"
    assert seg_path.exists(), "Expected segment_restrictions_long.parquet fixture to exist."

    seg_df = pd.read_parquet(seg_path)
    bay = seg_df[seg_df["bay_id"].astype(str) == "57923"].copy()
    assert len(bay) >= 4

    for col in ("starttime", "endtime"):
        bay[col] = bay[col].apply(parse_time_value)
    deduped = dedup_restrictions_for_db(bay)

    has_weekday = ((deduped["fromday"] == 1) & (deduped["today"] == 5)).any()
    has_weekend = ((deduped["fromday"] == 6) & (deduped["today"] == 0)).any()
    assert has_weekday, "Expected weekday window for bay 57923."
    assert has_weekend, "Expected weekend window for bay 57923."
