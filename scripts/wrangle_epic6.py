"""
wrangle_epic6.py
================
Epic 6 -- Predictive Parking Intelligence -- Data Wrangling
FIT5120 TE31  MeloPark  Monash University

PURPOSE
-------
Cleans and processes raw bronze data for the Epic 6 predictive model.

Takes these bronze inputs:
  data/bronze/epic6_traffic_signal_volume_raw.parquet  -- SCATS traffic volume (wide format)
  data/bronze/epic6_events_raw.parquet                 -- CoM What's On events
  data/bronze/epic6_venues_raw.parquet                 -- Event venue locations

Produces these silver outputs:
  data/silver/epic6_traffic_clean.parquet   -- Hourly traffic volume per site (long format)
  data/silver/epic6_events_clean.parquet    -- Cleaned events with lat/lon and crowd estimate

SCATS DATA FORMAT (Transport Victoria)
---------------------------------------
The raw traffic signal volume data uses SCATS (Sydney Coordinated Adaptive Traffic System) format.
Each row represents one detector at one site on one day.

Columns:
  NB_SCATS_SITE      -- traffic signal site ID
  QT_INTERVAL_COUNT  -- date of measurement (YYYY-MM-DD)
  NB_DETECTOR        -- detector loop number (per lane)
  V00 to V95         -- vehicle counts for each 15-minute interval
                        V00 = 00:00-00:15, V01 = 00:15-00:30, ..., V95 = 23:45-24:00
  QT_VOLUME_24HOUR   -- total 24-hour volume (validation field)
  NM_REGION          -- VicRoads region code

CONVERSION LOGIC (wide to long)
--------------------------------
  1. Melt V00-V95 columns into rows (one row per 15-min interval)
  2. Compute interval_num from column name (V00 -> 0, V95 -> 95)
  3. Derive hour = interval_num // 4  (4 intervals per hour)
  4. Aggregate to hourly sum per site/date/hour
  5. Parse QT_INTERVAL_COUNT as date, extract day_of_week and month
  6. Normalise volume per site (each site has different detector sensitivity)

OUTPUT SCHEMA (epic6_traffic_clean.parquet)
--------------------------------------------
  site_id        -- SCATS site identifier
  date           -- measurement date (YYYY-MM-DD)
  hour           -- hour of day (0-23)
  day_of_week    -- 0=Monday, 6=Sunday
  month          -- month number (1-12)
  traffic_volume -- total vehicle count for that hour across all detectors at site
  volume_norm    -- normalised volume [0, 1] relative to site maximum

EVENTS DATA FORMAT (CoM What's On API)
----------------------------------------
Expected columns in epic6_events_raw.parquet:
  event_name          -- name of the event
  start_datetime      -- ISO datetime of event start
  end_datetime        -- ISO datetime of event end
  lat / longitude     -- venue coordinates (may be nested in location dict)
  expected_attendance -- expected crowd size (may be called capacity)
  venue_name          -- venue name

HOW TO RUN
----------
  python scripts/wrangle_epic6.py
  python scripts/wrangle_epic6.py --dry-run    # preview only, no writes
  python scripts/wrangle_epic6.py --verbose    # extra logging

EXPECTED FOLDER STRUCTURE AFTER RUNNING
-----------------------------------------
  data/
    bronze/
      epic6_traffic_signal_volume_raw.parquet  <- input (SCATS wide format)
      epic6_events_raw.parquet                 <- input (CoM events)
      epic6_venues_raw.parquet                 <- input (optional venues)
    silver/
      epic6_traffic_clean.parquet              <- output (hourly long format)
      epic6_events_clean.parquet               <- output (cleaned events)
      epic6_wrangle_metadata.json              <- output (run stats)

DEPENDENCIES
------------
  pandas>=1.5  pyarrow>=12  numpy>=1.24

AUTHOR : FIT5120 TE31
DATE   : April 2026
"""

from __future__ import annotations

import argparse
import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

# ===========================================================================
# LOGGING
# ===========================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("wrangle_epic6")

# ===========================================================================
# PATHS
# ===========================================================================

ROOT       = Path(__file__).resolve().parent.parent
BRONZE_DIR = ROOT / "data" / "bronze"
SILVER_DIR = ROOT / "data" / "silver"

SILVER_DIR.mkdir(parents=True, exist_ok=True)

# ===========================================================================
# SECTION 1 -- LOAD BRONZE DATA
# ===========================================================================

def load_traffic_raw() -> pd.DataFrame:
    """
    Load raw SCATS traffic signal volume data from bronze layer.

    Tries silver cleaned version first, then falls back to raw bronze.
    Returns empty DataFrame if neither exists.
    """
    candidates = [
        BRONZE_DIR / "epic6_traffic_signal_volume_raw.parquet",
    ]
    for path in candidates:
        if path.exists():
            try:
                df = pd.read_parquet(path)
                df.columns = df.columns.str.strip()
                log.info(
                    "  Traffic raw: %d rows, %d columns from %s",
                    len(df), len(df.columns), path.name,
                )
                log.info("  Traffic columns: %s", list(df.columns[:10]))
                return df
            except Exception as exc:
                log.warning("  Cannot read %s: %s", path.name, exc)
    log.error(
        "  No traffic data found.\n"
        "  Expected: data/bronze/epic6_traffic_signal_volume_raw.parquet\n"
        "  Download from: https://opendata.transport.vic.gov.au/dataset/traffic-signal-volume-data"
    )
    return pd.DataFrame()


def load_events_raw() -> pd.DataFrame:
    """
    Load raw CoM events data from bronze layer.

    Expected file: data/bronze/epic6_events_raw.parquet
    Columns vary by source but we look for event_name, start_datetime, lat, lon.
    """
    path = BRONZE_DIR / "epic6_events_raw.parquet"
    if not path.exists():
        log.warning("  epic6_events_raw.parquet not found")
        return pd.DataFrame()
    try:
        df = pd.read_parquet(path)
        df.columns = df.columns.str.strip().str.lower()
        log.info(
            "  Events raw: %d rows, columns: %s",
            len(df), list(df.columns),
        )
        return df
    except Exception as exc:
        log.warning("  Cannot read epic6_events_raw.parquet: %s", exc)
        return pd.DataFrame()


def load_venues_raw() -> pd.DataFrame:
    """
    Load venue location data if available.

    Used to supplement events that are missing lat/lon.
    """
    path = BRONZE_DIR / "epic6_venues_raw.parquet"
    if not path.exists():
        return pd.DataFrame()
    try:
        df = pd.read_parquet(path)
        df.columns = df.columns.str.strip().str.lower()
        log.info("  Venues: %d rows", len(df))
        return df
    except Exception as exc:
        log.warning("  Cannot read venues: %s", exc)
        return pd.DataFrame()


# ===========================================================================
# SECTION 2 -- CLEAN SCATS TRAFFIC DATA
# ===========================================================================

def _detect_scats_format(df: pd.DataFrame) -> bool:
    """Return True if the DataFrame uses SCATS wide format (V00-V95 columns)."""
    v_cols = [c for c in df.columns if c.startswith("V") and c[1:].isdigit()]
    return len(v_cols) >= 10


def _melt_scats_to_long(df: pd.DataFrame) -> pd.DataFrame:
    """
    Convert SCATS wide format to long hourly format.

    SCATS has V00 to V95 representing 96 x 15-minute intervals per day.
    This function:
      1. Identifies V00-V95 columns
      2. Melts them into rows (one per 15-min interval)
      3. Computes hour = interval_num // 4
      4. Aggregates to hourly sum per site, date, and hour
    """
    # Identify the 96 interval columns
    v_cols = sorted(
        [c for c in df.columns if c.startswith("V") and c[1:].isdigit()],
        key=lambda x: int(x[1:]),
    )
    log.info("  SCATS: found %d interval columns (V00-V%s)", len(v_cols), v_cols[-1][1:])

    # Identify site and date columns
    site_col = next(
        (c for c in ["NB_SCATS_SITE", "site_id", "SITE_ID", "site"] if c in df.columns),
        None,
    )
    date_col = next(
        (c for c in ["QT_INTERVAL_COUNT", "date", "DATE", "measurement_date"] if c in df.columns),
        None,
    )
    detector_col = next(
        (c for c in ["NB_DETECTOR", "detector", "DETECTOR"] if c in df.columns),
        None,
    )

    if site_col is None or date_col is None:
        raise ValueError(
            f"Cannot find site or date column in SCATS data.\n"
            f"Available columns: {list(df.columns)}"
        )

    log.info(
        "  SCATS: site_col=%s  date_col=%s  detector_col=%s",
        site_col, date_col, detector_col,
    )

    # Melt V columns to long format
    id_vars = [c for c in [site_col, date_col, detector_col] if c]
    melted = df[id_vars + v_cols].melt(
        id_vars=id_vars,
        value_vars=v_cols,
        var_name="interval_col",
        value_name="vehicle_count_15min",
    )

    # Extract interval number and derive hour
    melted["interval_num"] = melted["interval_col"].str[1:].astype(int)
    melted["hour"]         = melted["interval_num"] // 4

    # Clean vehicle counts
    melted["vehicle_count_15min"] = pd.to_numeric(
        melted["vehicle_count_15min"], errors="coerce"
    ).fillna(0).clip(lower=0)

    # Aggregate: sum all detectors and 15-min intervals per site/date/hour
    group_cols = [site_col, date_col, "hour"]
    hourly = (
        melted.groupby(group_cols)["vehicle_count_15min"]
        .sum()
        .reset_index()
        .rename(columns={
            site_col:                  "site_id",
            date_col:                  "date",
            "vehicle_count_15min":     "traffic_volume",
        })
    )

    log.info(
        "  SCATS melted: %d -> %d hourly rows (%d sites)",
        len(df), len(hourly), hourly["site_id"].nunique(),
    )
    return hourly


def _extract_time_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Parse date column and extract day_of_week and month features.

    Expects a 'date' column in format YYYY-MM-DD.
    Adds: day_of_week (0=Mon, 6=Sun), month (1-12), year.
    """
    df = df.copy()
    df["date_parsed"] = pd.to_datetime(df["date"], errors="coerce")

    invalid = df["date_parsed"].isna().sum()
    if invalid > 0:
        log.warning("  %d rows with unparseable dates -- dropping", invalid)
        df = df.dropna(subset=["date_parsed"])

    df["day_of_week"] = df["date_parsed"].dt.dayofweek   # 0=Monday
    df["month"]       = df["date_parsed"].dt.month
    df["year"]        = df["date_parsed"].dt.year

    # Log date range
    log.info(
        "  Date range: %s to %s",
        df["date_parsed"].min().date(),
        df["date_parsed"].max().date(),
    )
    return df


def _normalise_volume(df: pd.DataFrame) -> pd.DataFrame:
    """
    Normalise traffic_volume per site to [0, 1].

    Each SCATS site has different sensitivity and detector count.
    Normalising per site makes volumes comparable across sites.
    """
    df = df.copy()
    site_max = df.groupby("site_id")["traffic_volume"].transform("max")
    df["volume_norm"] = (df["traffic_volume"] / site_max.replace(0, 1)).clip(0, 1)
    log.info(
        "  Volume normalised: mean=%.3f  std=%.3f",
        float(df["volume_norm"].mean()),
        float(df["volume_norm"].std()),
    )
    return df


def clean_traffic(df_raw: pd.DataFrame) -> pd.DataFrame:
    """
    Full SCATS traffic data cleaning pipeline.

    Steps:
      1. Detect if SCATS wide format
      2. If SCATS: melt V00-V95 to hourly long format
      3. If already long: detect and rename columns
      4. Extract time features (day_of_week, month)
      5. Normalise traffic volume per site
      6. Drop rows with missing required fields

    Returns long-format DataFrame with columns:
      site_id, date, hour, day_of_week, month, year,
      traffic_volume, volume_norm
    """
    if df_raw.empty:
        log.error("  No traffic data to clean")
        return pd.DataFrame()

    df = df_raw.copy()

    # ------------------------------------------------------------------
    # Step 1 & 2: Convert SCATS wide to long if needed
    # ------------------------------------------------------------------
    if _detect_scats_format(df):
        log.info("  Detected SCATS wide format -- converting to hourly long...")
        df = _melt_scats_to_long(df)
    else:
        log.info("  Traffic data appears to be in long format already")
        # Try to standardise column names
        col_map = {}
        for src, tgt in [
            ("nb_scats_site", "site_id"),
            ("qt_interval_count", "date"),
            ("volume", "traffic_volume"),
            ("count", "traffic_volume"),
            ("vehicle_count", "traffic_volume"),
        ]:
            if src in df.columns and tgt not in df.columns:
                col_map[src] = tgt
        if col_map:
            df = df.rename(columns=col_map)
            log.info("  Renamed columns: %s", col_map)

    # ------------------------------------------------------------------
    # Step 3: Extract time features
    # ------------------------------------------------------------------
    if "date" in df.columns:
        df = _extract_time_features(df)
    elif "hour" not in df.columns:
        log.error("  No date or hour column found -- cannot extract time features")
        return pd.DataFrame()

    # Ensure hour is integer
    df["hour"] = pd.to_numeric(df.get("hour", 0), errors="coerce").fillna(0).astype(int)
    df["hour"] = df["hour"].clip(0, 23)

    # ------------------------------------------------------------------
    # Step 4: Validate traffic_volume
    # ------------------------------------------------------------------
    if "traffic_volume" not in df.columns:
        vol_col = next(
            (c for c in df.columns if "volume" in c.lower() or "count" in c.lower()),
            None,
        )
        if vol_col:
            df = df.rename(columns={vol_col: "traffic_volume"})
        else:
            log.error("  No traffic volume column found")
            return pd.DataFrame()

    df["traffic_volume"] = pd.to_numeric(df["traffic_volume"], errors="coerce").fillna(0)
    df = df[df["traffic_volume"] >= 0]

    # ------------------------------------------------------------------
    # Step 5: Normalise per site
    # ------------------------------------------------------------------
    if "site_id" in df.columns:
        df = _normalise_volume(df)
    else:
        global_max = df["traffic_volume"].max()
        df["volume_norm"] = (df["traffic_volume"] / max(float(global_max), 1)).clip(0, 1)

    # ------------------------------------------------------------------
    # Step 6: Final cleanup
    # ------------------------------------------------------------------
    keep_cols = [c for c in [
        "site_id", "date", "hour", "day_of_week", "month", "year",
        "traffic_volume", "volume_norm",
    ] if c in df.columns]

    df_out = df[keep_cols].dropna(subset=["hour", "traffic_volume"]).copy()
    df_out = df_out.reset_index(drop=True)

    log.info(
        "  Traffic clean: %d rows, %d sites, %d unique dates",
        len(df_out),
        df_out["site_id"].nunique() if "site_id" in df_out.columns else 0,
        df_out["date"].nunique() if "date" in df_out.columns else 0,
    )
    return df_out


# ===========================================================================
# SECTION 3 -- CLEAN EVENTS DATA
# ===========================================================================

def clean_events(df_raw: pd.DataFrame, df_venues: pd.DataFrame) -> pd.DataFrame:
    """
    Clean CoM What's On events data.

    Steps:
      1. Standardise column names
      2. Parse start/end datetimes
      3. Extract lat/lon from nested location dict if needed
      4. Fill missing lat/lon from venues lookup
      5. Filter to future or recent events (last 90 days + future)
      6. Standardise crowd estimate column
      7. Filter to Melbourne CBD bounding box

    Returns clean events DataFrame with columns:
      event_name, start_datetime, end_datetime, lat, lon,
      expected_capacity, venue_name, source
    """
    if df_raw.empty:
        log.warning("  No events data to clean")
        return pd.DataFrame()

    df = df_raw.copy()

    # ------------------------------------------------------------------
    # Step 1: Standardise column names
    # ------------------------------------------------------------------
    col_aliases = {
        "name":                    "event_name",
        "title":                   "event_name",
        "start":                   "start_datetime",
        "startdatetime":           "start_datetime",
        "event_start":             "start_datetime",
        "end":                     "end_datetime",
        "enddatetime":             "end_datetime",
        "event_end":               "end_datetime",
        "latitude":                "lat",
        "longitude":               "lon",
        "expected_attendance":     "expected_capacity",
        "attendance":              "expected_capacity",
        "capacity":                "expected_capacity",
        "max_capacity":            "expected_capacity",
        "location.lat":            "lat",
        "location.lon":            "lon",
    }
    for src, tgt in col_aliases.items():
        if src in df.columns and tgt not in df.columns:
            df = df.rename(columns={src: tgt})

    # ------------------------------------------------------------------
    # Step 2: Parse datetimes
    # ------------------------------------------------------------------
    for dt_col in ["start_datetime", "end_datetime"]:
        if dt_col in df.columns:
            df[dt_col] = pd.to_datetime(df[dt_col], utc=True, errors="coerce")

    if "start_datetime" not in df.columns:
        log.warning("  No start_datetime column in events -- cannot filter by time")
        return pd.DataFrame()

    df = df.dropna(subset=["start_datetime"])
    log.info("  Events after dropping null start_datetime: %d", len(df))

    # ------------------------------------------------------------------
    # Step 3: Extract lat/lon from nested location dict
    # ------------------------------------------------------------------
    if "lat" not in df.columns and "location" in df.columns:
        df["lat"] = df["location"].apply(
            lambda x: x.get("lat") if isinstance(x, dict) else None
        )
        df["lon"] = df["location"].apply(
            lambda x: x.get("lon") if isinstance(x, dict) else None
        )

    # Normalise geo columns to float
    for geo_col in ["lat", "lon"]:
        if geo_col in df.columns:
            df[geo_col] = pd.to_numeric(df[geo_col], errors="coerce")

    # ------------------------------------------------------------------
    # Step 4: Fill missing lat/lon from venues
    # ------------------------------------------------------------------
    if not df_venues.empty and "venue_name" in df.columns:
        venue_lookup = {}
        for _, v in df_venues.iterrows():
            name = str(v.get("venue_name") or v.get("name") or "")
            vlat = v.get("latitude") or v.get("lat")
            vlon = v.get("longitude") or v.get("lon")
            if name and vlat and vlon:
                venue_lookup[name.lower()] = (float(vlat), float(vlon))

        filled = 0
        for idx, row in df.iterrows():
            if pd.isna(row.get("lat")) or pd.isna(row.get("lon")):
                vname = str(row.get("venue_name") or "").lower()
                if vname in venue_lookup:
                    df.at[idx, "lat"] = venue_lookup[vname][0]
                    df.at[idx, "lon"] = venue_lookup[vname][1]
                    filled += 1
        if filled:
            log.info("  Filled %d missing event locations from venues lookup", filled)

    # ------------------------------------------------------------------
    # Step 5: Filter to CBD bounding box (events without location kept for warnings)
    # ------------------------------------------------------------------
    if "lat" in df.columns and "lon" in df.columns:
        has_location = df["lat"].notna() & df["lon"].notna()
        cbd_mask = (
            (df["lat"]  >= -37.860) & (df["lat"]  <= -37.780) &
            (df["lon"]  >= 144.900) & (df["lon"]  <= 145.010)
        )
        df = df[~has_location | cbd_mask].copy()
        log.info("  Events after CBD filter: %d", len(df))

    # ------------------------------------------------------------------
    # Step 6: Standardise expected_capacity
    # ------------------------------------------------------------------
    if "expected_capacity" in df.columns:
        df["expected_capacity"] = pd.to_numeric(
            df["expected_capacity"], errors="coerce"
        ).fillna(1000)
        df["expected_capacity"] = df["expected_capacity"].clip(lower=1)
    else:
        df["expected_capacity"] = 1000.0

    # ------------------------------------------------------------------
    # Step 7: Keep only needed columns
    # ------------------------------------------------------------------
    keep = [c for c in [
        "event_name", "start_datetime", "end_datetime",
        "lat", "lon", "expected_capacity", "venue_name", "event_url",
    ] if c in df.columns]
    df = df[keep].copy()
    df["source"] = "CoM_whats_on"

    log.info(
        "  Events clean: %d rows | has_location: %d",
        len(df),
        df["lat"].notna().sum() if "lat" in df.columns else 0,
    )
    return df.reset_index(drop=True)


# ===========================================================================
# MAIN
# ===========================================================================

def main(dry_run: bool = False, verbose: bool = False) -> None:
    """
    Full Epic 6 data wrangling pipeline.

    Steps:
      1. Load bronze traffic and events data
      2. Clean and convert SCATS traffic to hourly long format
      3. Clean events data
      4. Save silver outputs
    """
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    log.info("=" * 60)
    log.info("  Epic 6 -- Predictive Parking Data Wrangling")
    log.info("=" * 60)

    # ------------------------------------------------------------------
    # Step 1: Load
    # ------------------------------------------------------------------
    log.info("\n[1/3] Loading bronze data...")
    df_traffic_raw = load_traffic_raw()
    df_events_raw  = load_events_raw()
    df_venues_raw  = load_venues_raw()

    # ------------------------------------------------------------------
    # Step 2: Clean traffic
    # ------------------------------------------------------------------
    log.info("\n[2/3] Cleaning SCATS traffic data...")
    df_traffic_clean = clean_traffic(df_traffic_raw)

    # ------------------------------------------------------------------
    # Step 3: Clean events
    # ------------------------------------------------------------------
    log.info("\n[3/3] Cleaning events data...")
    df_events_clean = clean_events(df_events_raw, df_venues_raw)

    # ------------------------------------------------------------------
    # Write outputs
    # ------------------------------------------------------------------
    if dry_run:
        log.info("\nDRY RUN -- no files written")
        log.info("  Traffic clean: %d rows", len(df_traffic_clean))
        log.info("  Events clean : %d rows", len(df_events_clean))
        if not df_traffic_clean.empty:
            log.info("\n  Traffic sample:")
            log.info(df_traffic_clean.head(3).to_string())
        if not df_events_clean.empty:
            log.info("\n  Events sample:")
            log.info(df_events_clean.head(3).to_string())
        return

    outputs = {
        SILVER_DIR / "epic6_traffic_clean.parquet": (
            df_traffic_clean if not df_traffic_clean.empty
            else pd.DataFrame([{"note": "no traffic data"}])
        ),
        SILVER_DIR / "epic6_events_clean.parquet": (
            df_events_clean if not df_events_clean.empty
            else pd.DataFrame([{"note": "no events data"}])
        ),
    }

    for path, df_out in outputs.items():
        df_out.to_parquet(path, index=False, engine="pyarrow")
        log.info("  Saved %s (%d rows)", path.name, len(df_out))

    # Save metadata
    meta = {
        "built_at":             datetime.now(timezone.utc).isoformat(),
        "pipeline_stage":       "silver",
        "epic":                 "epic6",
        "traffic_input_rows":   len(df_traffic_raw),
        "traffic_output_rows":  len(df_traffic_clean),
        "events_input_rows":    len(df_events_raw),
        "events_output_rows":   len(df_events_clean),
        "traffic_sites":        int(df_traffic_clean["site_id"].nunique())
                                if not df_traffic_clean.empty and "site_id" in df_traffic_clean.columns
                                else 0,
    }
    meta_path = SILVER_DIR / "epic6_wrangle_metadata.json"
    meta_path.write_text(json.dumps(meta, indent=2))
    log.info("  Saved epic6_wrangle_metadata.json")

    log.info("\n" + "=" * 60)
    log.info("  Epic 6 wrangling complete")
    log.info("  Silver -> %s", SILVER_DIR)
    log.info("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Epic 6 predictive parking data wrangling pipeline.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python scripts/wrangle_epic6.py\n"
            "  python scripts/wrangle_epic6.py --dry-run\n"
            "  python scripts/wrangle_epic6.py --verbose\n"
        ),
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview outputs without writing files.")
    parser.add_argument("--verbose", action="store_true",
                        help="Extra debug logging.")
    args = parser.parse_args()
    main(dry_run=args.dry_run, verbose=args.verbose)
