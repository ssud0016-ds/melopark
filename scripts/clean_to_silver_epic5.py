"""
clean_to_silver_epic5.py - Bronze -> Silver transforms for Epic 5 (parking pressure).

Inputs (data/bronze/):
    epic5_scats_sites_raw.parquet
    epic5_traffic_signal_volume_raw.parquet
    epic5_events_raw.parquet            (may be empty if Eventfinda creds absent)

Outputs (data/silver/):
    epic5_scats_sites_clean.parquet     SCATS site geo, CBD only
    epic5_traffic_long.parquet          (site_no, date, detector, hour, qhour, volume) long form
    epic5_traffic_site_hourly.parquet   (site_no, date, hour, volume_total) detector-summed
    epic5_traffic_profile.parquet       (site_no, dow, hour, median_volume, p90_volume, lat, lon)
    epic5_events_clean.parquet          deduped, future-only, parsed datetimes, CBD bbox
    epic5_pressure_clean_metadata.json  build summary
    epic5_pressure_qa_report.json       row counts, match rates, null rates
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("clean_to_silver_epic5")

ROOT = Path(__file__).resolve().parent.parent
BRONZE = ROOT / "data" / "bronze"
SILVER = ROOT / "data" / "silver"

CBD_BBOX = {
    "lat_min": -37.83, "lat_max": -37.79,
    "lon_min": 144.94, "lon_max": 144.99,
}

V_COLS = [f"V{i:02d}" for i in range(96)]


def clean_scats_sites() -> pd.DataFrame:
    src = BRONZE / "epic5_scats_sites_raw.parquet"
    df = pd.read_parquet(src)
    df = df.dropna(subset=["site_no", "lat", "lon"]).copy()
    df["site_no"] = df["site_no"].astype(int)
    df["site_name"] = df["site_name"].astype(str).str.strip()
    df["municipality"] = df["municipality"].astype(str).str.strip()
    df = df.drop_duplicates(subset=["site_no"])
    out = SILVER / "epic5_scats_sites_clean.parquet"
    df.to_parquet(out, index=False, engine="pyarrow")
    log.info("scats_sites_clean: %d rows -> %s", len(df), out.name)
    return df


def melt_traffic_long(sites: pd.DataFrame) -> pd.DataFrame:
    """Wide V00..V95 -> long (site, date, detector, qhour, hour, volume)."""
    src = BRONZE / "epic5_traffic_signal_volume_raw.parquet"
    df = pd.read_parquet(src)

    keep = ["NB_SCATS_SITE", "QT_INTERVAL_COUNT", "NB_DETECTOR"] + V_COLS
    df = df[keep].copy()
    df = df.rename(columns={
        "NB_SCATS_SITE": "site_no",
        "QT_INTERVAL_COUNT": "date",
        "NB_DETECTOR": "detector",
    })
    df["site_no"] = df["site_no"].astype(int)
    df["date"] = pd.to_datetime(df["date"], errors="coerce").dt.date
    df = df.dropna(subset=["date"])
    df = df[df["site_no"].isin(sites["site_no"])]

    long = df.melt(
        id_vars=["site_no", "date", "detector"],
        value_vars=V_COLS,
        var_name="qhour_label",
        value_name="volume",
    )
    long["qhour"] = long["qhour_label"].str[1:].astype(int)
    long["hour"] = long["qhour"] // 4
    long = long.drop(columns=["qhour_label"])
    long["volume"] = pd.to_numeric(long["volume"], errors="coerce").fillna(0).astype(int)

    out = SILVER / "epic5_traffic_long.parquet"
    long.to_parquet(out, index=False, engine="pyarrow")
    log.info("traffic_long: %d rows -> %s", len(long), out.name)
    return long


def build_site_hourly(long: pd.DataFrame) -> pd.DataFrame:
    """Sum detectors and 4 quarter-hours -> per (site, date, hour) total volume."""
    grouped = (
        long.groupby(["site_no", "date", "hour"], as_index=False)["volume"]
        .sum()
        .rename(columns={"volume": "volume_total"})
    )
    out = SILVER / "epic5_traffic_site_hourly.parquet"
    grouped.to_parquet(out, index=False, engine="pyarrow")
    log.info("traffic_site_hourly: %d rows -> %s", len(grouped), out.name)
    return grouped


def build_profile(hourly: pd.DataFrame, sites: pd.DataFrame) -> pd.DataFrame:
    """Site x day-of-week x hour median + p90 volume, joined to geo."""
    df = hourly.copy()
    df["date"] = pd.to_datetime(df["date"])
    df["dow"] = df["date"].dt.dayofweek

    profile = (
        df.groupby(["site_no", "dow", "hour"], as_index=False)
        .agg(
            median_volume=("volume_total", "median"),
            p90_volume=("volume_total", lambda s: float(np.percentile(s, 90))),
            sample_days=("volume_total", "count"),
        )
    )
    profile = profile.merge(
        sites[["site_no", "site_name", "lat", "lon"]],
        on="site_no",
        how="left",
    )
    out = SILVER / "epic5_traffic_profile.parquet"
    profile.to_parquet(out, index=False, engine="pyarrow")
    log.info("traffic_profile: %d rows -> %s", len(profile), out.name)
    return profile


def clean_events() -> pd.DataFrame:
    src = BRONZE / "epic5_events_raw.parquet"
    if not src.exists():
        log.warning("events bronze missing — writing empty silver.")
        df = pd.DataFrame(columns=[
            "event_id", "event_name", "start_datetime", "end_datetime",
            "lat", "lon", "venue_name", "category_names", "event_url",
        ])
        out = SILVER / "epic5_events_clean.parquet"
        df.to_parquet(out, index=False, engine="pyarrow")
        return df

    df = pd.read_parquet(src)
    if df.empty:
        log.warning("events bronze empty — writing empty silver.")
        out = SILVER / "epic5_events_clean.parquet"
        df.to_parquet(out, index=False, engine="pyarrow")
        return df

    df = df.copy()
    df["start_datetime"] = pd.to_datetime(df["start_datetime"], errors="coerce", utc=True)
    df["end_datetime"] = pd.to_datetime(df["end_datetime"], errors="coerce", utc=True)
    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lon"] = pd.to_numeric(df["lon"], errors="coerce")

    df = df.dropna(subset=["start_datetime", "lat", "lon"])
    now = pd.Timestamp.now(tz="UTC")
    df = df[df["end_datetime"].fillna(df["start_datetime"]) >= now]

    in_bbox = (
        (df["lat"] >= CBD_BBOX["lat_min"]) & (df["lat"] <= CBD_BBOX["lat_max"]) &
        (df["lon"] >= CBD_BBOX["lon_min"]) & (df["lon"] <= CBD_BBOX["lon_max"])
    )
    df = df[in_bbox]
    df = df.drop_duplicates(subset=["event_id"])

    out = SILVER / "epic5_events_clean.parquet"
    df.to_parquet(out, index=False, engine="pyarrow")
    log.info("events_clean: %d rows -> %s", len(df), out.name)
    return df


def main() -> None:
    SILVER.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc)
    log.info("Epic 5 silver build starting at %s", started.isoformat())

    sites = clean_scats_sites()
    long = melt_traffic_long(sites)
    hourly = build_site_hourly(long)
    profile = build_profile(hourly, sites)
    events = clean_events()

    qa = {
        "scats_sites": int(len(sites)),
        "traffic_long_rows": int(len(long)),
        "traffic_site_hourly_rows": int(len(hourly)),
        "traffic_profile_rows": int(len(profile)),
        "traffic_unique_sites": int(long["site_no"].nunique()),
        "traffic_date_min": str(long["date"].min()),
        "traffic_date_max": str(long["date"].max()),
        "traffic_volume_zero_frac": float((long["volume"] == 0).mean()),
        "profile_match_to_geo_pct": float(
            profile["lat"].notna().mean() * 100.0
        ),
        "events_rows": int(len(events)),
    }
    qa_path = SILVER / "epic5_pressure_qa_report.json"
    with open(qa_path, "w") as f:
        json.dump(qa, f, indent=2)
    log.info("QA report -> %s", qa_path.name)

    meta = {
        "pipeline_stage": "silver",
        "epic": "epic5",
        "feature": "parking_pressure_map",
        "built_at": started.isoformat(),
        "outputs": [
            "epic5_scats_sites_clean.parquet",
            "epic5_traffic_long.parquet",
            "epic5_traffic_site_hourly.parquet",
            "epic5_traffic_profile.parquet",
            "epic5_events_clean.parquet",
        ],
        "qa": qa,
    }
    meta_path = SILVER / "epic5_pressure_clean_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    log.info("Silver metadata -> %s", meta_path.name)


if __name__ == "__main__":
    main()
