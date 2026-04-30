"""
wrangle_epic5.py
================
Epic 5 -- Zone Pressure Model -- Data Wrangling
FIT5120 TE31  MeloPark  Monash University

PURPOSE
-------
Cleans and processes raw bronze data for the Epic 5 zone pressure model.

Takes these bronze inputs:
  data/bronze/epic5_ped_counts_raw.parquet     -- CoM pedestrian sensor counts
  data/bronze/epic5_ped_locations_raw.parquet  -- CoM pedestrian sensor locations
  data/bronze/sensors.parquet                 -- Live CoM parking bay sensor data

Produces these silver outputs:
  data/silver/epic5_ped_hourly.parquet         -- Hourly pedestrian counts per sensor site
  data/silver/epic5_ped_locations.parquet      -- Cleaned sensor locations with zone assignment
  data/silver/epic5_zone_pressure.parquet      -- Zone pressure scores (0-100) per hour

And these gold outputs:
  data/gold/epic5_zone_pressure_latest.parquet -- Latest zone pressure for frontend

ZONE DEFINITIONS (Melbourne CBD bounding boxes, WGS84)
------------------------------------------------------
  CBD North   -> lat -37.809 to -37.804, lng 144.955 to 144.975
  CBD Central -> lat -37.814 to -37.809, lng 144.955 to 144.975
  CBD South   -> lat -37.820 to -37.814, lng 144.955 to 144.975
  Docklands   -> lat -37.820 to -37.810, lng 144.938 to 144.955
  Southbank   -> lat -37.826 to -37.820, lng 144.955 to 144.975

PRESSURE SCORE FORMULA
----------------------
  occupancy_rate   = occupied_bays / total_bays_in_zone
  ped_factor       = normalised pedestrian count for zone (0 to 1)
  pressure_score   = occupancy_rate * 0.85 + ped_factor * 0.15
  pressure_status  = GREEN (<50) | AMBER (50-80) | RED (>80)

PEDESTRIAN DATA FORMAT (CoM API)
----------------------------------
  ped_counts_raw columns:
    sensor_id     -- unique sensor identifier
    date_time     -- timestamp of count
    hourly_count  -- number of pedestrians counted in that hour

  ped_locations_raw columns:
    sensor_id       -- matches ped_counts_raw
    sensor_description -- location name
    latitude        -- WGS84 latitude
    longitude       -- WGS84 longitude
    status          -- active/inactive

HOW TO RUN
----------
  python scripts/wrangle_epic5.py
  python scripts/wrangle_epic5.py --dry-run    # preview only, no writes
  python scripts/wrangle_epic5.py --verbose    # extra logging

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
log = logging.getLogger("wrangle_epic5")

# ===========================================================================
# PATHS
# ===========================================================================

ROOT       = Path(__file__).resolve().parent.parent
BRONZE_DIR = ROOT / "data" / "bronze"
SILVER_DIR = ROOT / "data" / "silver"
GOLD_DIR   = ROOT / "data" / "gold"

SILVER_DIR.mkdir(parents=True, exist_ok=True)
GOLD_DIR.mkdir(parents=True, exist_ok=True)

# ===========================================================================
# ZONE DEFINITIONS
# ===========================================================================

ZONES = {
    "CBD North":   dict(lat_min=-37.809, lat_max=-37.804, lng_min=144.955, lng_max=144.975),
    "CBD Central": dict(lat_min=-37.814, lat_max=-37.809, lng_min=144.955, lng_max=144.975),
    "CBD South":   dict(lat_min=-37.820, lat_max=-37.814, lng_min=144.955, lng_max=144.975),
    "Docklands":   dict(lat_min=-37.820, lat_max=-37.810, lng_min=144.938, lng_max=144.955),
    "Southbank":   dict(lat_min=-37.826, lat_max=-37.820, lng_min=144.955, lng_max=144.975),
}

ZONE_CENTRES = {
    z: (
        (b["lat_min"] + b["lat_max"]) / 2,
        (b["lng_min"] + b["lng_max"]) / 2,
    )
    for z, b in ZONES.items()
}


# ===========================================================================
# HELPERS
# ===========================================================================

def assign_zone(lat: float, lon: float) -> str | None:
    """Return zone name for a lat/lon point, or None if outside all zones."""
    for name, b in ZONES.items():
        if (b["lat_min"] <= lat <= b["lat_max"]
                and b["lng_min"] <= lon <= b["lng_max"]):
            return name
    return None


def pressure_status(score: float) -> str:
    """Convert numeric pressure score to status label."""
    if score >= 80:
        return "RED"
    if score >= 50:
        return "AMBER"
    return "GREEN"


# ===========================================================================
# SECTION 1 -- LOAD BRONZE DATA
# ===========================================================================

def load_ped_counts() -> pd.DataFrame:
    """
    Load raw pedestrian count data from bronze layer.

    Expected columns: sensor_id, date_time, hourly_count
    Falls back gracefully if file missing.
    """
    path = BRONZE_DIR / "epic5_ped_counts_raw.parquet"
    if not path.exists():
        log.warning("  epic5_ped_counts_raw.parquet not found -- run fetch_bronze.py first")
        return pd.DataFrame()
    try:
        df = pd.read_parquet(path)
        df.columns = df.columns.str.strip().str.lower()
        log.info("  Pedestrian counts: %d rows, columns: %s", len(df), list(df.columns))
        return df
    except Exception as exc:
        log.error("  Cannot read ped counts: %s", exc)
        return pd.DataFrame()


def load_ped_locations() -> pd.DataFrame:
    """
    Load pedestrian sensor location data from bronze layer.

    Expected columns: sensor_id, latitude, longitude, sensor_description, status
    """
    path = BRONZE_DIR / "epic5_ped_locations_raw.parquet"
    if not path.exists():
        log.warning("  epic5_ped_locations_raw.parquet not found -- run fetch_bronze.py first")
        return pd.DataFrame()
    try:
        df = pd.read_parquet(path)
        df.columns = df.columns.str.strip().str.lower()
        log.info("  Pedestrian locations: %d rows, columns: %s", len(df), list(df.columns))
        return df
    except Exception as exc:
        log.error("  Cannot read ped locations: %s", exc)
        return pd.DataFrame()


def load_sensors() -> pd.DataFrame:
    """
    Load live parking bay sensor data for occupancy calculation.

    Expected columns: bay_id, lat, lon, status (present/absent)
    """
    path = BRONZE_DIR / "sensors.parquet"
    if not path.exists():
        log.warning("  sensors.parquet not found")
        return pd.DataFrame()
    try:
        df = pd.read_parquet(path)
        df.columns = df.columns.str.strip().str.lower()

        # Extract lat/lon from nested location dict if needed
        if "location" in df.columns and "lat" not in df.columns:
            df["lat"] = df["location"].apply(
                lambda x: x.get("lat") if isinstance(x, dict) else None
            )
            df["lon"] = df["location"].apply(
                lambda x: x.get("lon") if isinstance(x, dict) else None
            )

        # Normalise bay_id column name
        if "kerbsideid" in df.columns:
            df = df.rename(columns={"kerbsideid": "bay_id"})

        df["lat"] = pd.to_numeric(df.get("lat"), errors="coerce")
        df["lon"] = pd.to_numeric(df.get("lon"), errors="coerce")
        df = df.dropna(subset=["lat", "lon"])

        # Assign zones
        df["zone"] = df.apply(
            lambda r: assign_zone(float(r["lat"]), float(r["lon"])), axis=1
        )

        log.info("  Sensors: %d rows", len(df))
        return df
    except Exception as exc:
        log.error("  Cannot read sensors: %s", exc)
        return pd.DataFrame()


# ===========================================================================
# SECTION 2 -- CLEAN PEDESTRIAN DATA
# ===========================================================================

def clean_ped_locations(df: pd.DataFrame) -> pd.DataFrame:
    """
    Clean pedestrian sensor location data.

    Steps:
      1. Standardise column names
      2. Parse latitude and longitude to float
      3. Drop rows with invalid or missing coordinates
      4. Filter to Melbourne CBD bounding box
      5. Assign zone to each sensor
      6. Drop inactive sensors
    """
    if df.empty:
        return df

    df = df.copy()

    # Standardise lat/lon column names
    lat_col = next((c for c in df.columns if "lat" in c), None)
    lon_col = next((c for c in df.columns if "lon" in c or "lng" in c), None)
    if lat_col and lat_col != "latitude":
        df = df.rename(columns={lat_col: "latitude"})
    if lon_col and lon_col != "longitude":
        df = df.rename(columns={lon_col: "longitude"})

    df["latitude"]  = pd.to_numeric(df.get("latitude"),  errors="coerce")
    df["longitude"] = pd.to_numeric(df.get("longitude"), errors="coerce")

    before = len(df)
    df = df.dropna(subset=["latitude", "longitude"])

    # Filter to Melbourne CBD bounding box
    cbd_mask = (
        (df["latitude"]  >= -37.830) & (df["latitude"]  <= -37.795) &
        (df["longitude"] >= 144.930) & (df["longitude"] <= 144.985)
    )
    df = df[cbd_mask].copy()
    after = len(df)
    log.info("  Ped locations: %d -> %d rows after coordinate filtering", before, after)

    # Drop inactive sensors
    if "status" in df.columns:
        df = df[df["status"].str.lower() != "inactive"].copy()
        log.info("  Ped locations after removing inactive: %d rows", len(df))

    # Assign zone
    df["zone"] = df.apply(
        lambda r: assign_zone(float(r["latitude"]), float(r["longitude"])),
        axis=1,
    )

    in_zone = df["zone"].notna().sum()
    log.info("  Ped sensors in CBD zones: %d of %d", in_zone, len(df))

    return df


def clean_ped_counts(
    df_counts: pd.DataFrame,
    df_locations: pd.DataFrame,
) -> pd.DataFrame:
    """
    Clean and aggregate pedestrian count data to hourly per sensor.

    Steps:
      1. Detect and parse datetime column
      2. Extract hour, day_of_week, month
      3. Detect and clean count column
      4. Join sensor location (zone) onto counts
      5. Aggregate to hourly total per sensor per hour

    Returns a long-format DataFrame with columns:
      sensor_id, zone, date, hour, day_of_week, month, hourly_count
    """
    if df_counts.empty:
        return pd.DataFrame()

    df = df_counts.copy()

    # ------------------------------------------------------------------
    # Step 1: Find datetime column
    # ------------------------------------------------------------------
    dt_col = next(
        (c for c in ["date_time", "datetime", "timestamp", "time", "date"]
         if c in df.columns),
        None,
    )
    if dt_col is None:
        log.warning("  No datetime column found in ped counts -- cannot process")
        return pd.DataFrame()

    df["datetime_parsed"] = pd.to_datetime(df[dt_col], errors="coerce", utc=True)
    df = df.dropna(subset=["datetime_parsed"])

    # Convert to Melbourne local time
    try:
        df["datetime_mel"] = df["datetime_parsed"].dt.tz_convert("Australia/Melbourne")
    except Exception:
        df["datetime_mel"] = df["datetime_parsed"]

    df["date"]        = df["datetime_mel"].dt.date.astype(str)
    df["hour"]        = df["datetime_mel"].dt.hour
    df["day_of_week"] = df["datetime_mel"].dt.dayofweek
    df["month"]       = df["datetime_mel"].dt.month

    # ------------------------------------------------------------------
    # Step 2: Find count column
    # ------------------------------------------------------------------
    count_col = next(
        (c for c in ["hourly_count", "count", "total", "pedestrian_count", "value"]
         if c in df.columns),
        None,
    )
    if count_col is None:
        log.warning("  No count column found in ped counts")
        return pd.DataFrame()

    df[count_col] = pd.to_numeric(df[count_col], errors="coerce").fillna(0)
    df = df[df[count_col] >= 0]  # drop negative counts

    # ------------------------------------------------------------------
    # Step 3: Standardise sensor_id column
    # ------------------------------------------------------------------
    sensor_col = next(
        (c for c in ["sensor_id", "sensorid", "id", "location_id"] if c in df.columns),
        None,
    )
    if sensor_col and sensor_col != "sensor_id":
        df = df.rename(columns={sensor_col: "sensor_id"})

    # ------------------------------------------------------------------
    # Step 4: Join zone from locations
    # ------------------------------------------------------------------
    if not df_locations.empty and "sensor_id" in df.columns:
        loc_cols = ["sensor_id", "zone"]
        if "sensor_description" in df_locations.columns:
            loc_cols.append("sensor_description")
        df = df.merge(
            df_locations[loc_cols].drop_duplicates("sensor_id"),
            on="sensor_id",
            how="left",
        )
    else:
        df["zone"] = None

    # ------------------------------------------------------------------
    # Step 5: Aggregate to hourly per sensor
    # ------------------------------------------------------------------
    group_cols = [c for c in ["sensor_id", "zone", "date", "hour", "day_of_week", "month"]
                  if c in df.columns]
    hourly = (
        df.groupby(group_cols)[count_col]
        .sum()
        .reset_index()
        .rename(columns={count_col: "hourly_count"})
    )

    log.info(
        "  Ped counts cleaned: %d hourly rows, %d sensors",
        len(hourly),
        hourly["sensor_id"].nunique() if "sensor_id" in hourly.columns else 0,
    )
    return hourly


# ===========================================================================
# SECTION 3 -- COMPUTE ZONE PRESSURE
# ===========================================================================

def compute_zone_pressure(
    sensors: pd.DataFrame,
    ped_hourly: pd.DataFrame,
) -> pd.DataFrame:
    """
    Compute zone pressure score for each zone.

    Formula:
      occupancy_rate = occupied_bays / total_bays_in_zone
      ped_factor     = zone_ped_count / max_ped_count_across_zones (normalised)
      pressure_score = occupancy_rate * 0.85 + ped_factor * 0.15

    Returns one row per zone with columns:
      zone, total_bays, occupied, free, occupancy_rate,
      ped_count, ped_factor, pressure_score, pressure_status,
      zone_lat, zone_lon, computed_at
    """
    rows = []
    now  = datetime.now(timezone.utc).isoformat()

    # Compute occupancy per zone from live sensors
    zone_occupancy = {}
    if not sensors.empty and "zone" in sensors.columns:
        status_col = next(
            (c for c in ["status", "status_description"] if c in sensors.columns),
            None,
        )
        for zone in ZONES:
            zone_bays = sensors[sensors["zone"] == zone]
            total     = len(zone_bays)
            if total == 0:
                zone_occupancy[zone] = {"total": 0, "occupied": 0, "free": 0, "rate": 0.0}
                continue
            if status_col:
                occupied = int(
                    zone_bays[status_col]
                    .str.lower()
                    .isin(["present", "occupied"])
                    .sum()
                )
            else:
                occupied = 0
            free = total - occupied
            zone_occupancy[zone] = {
                "total":    total,
                "occupied": occupied,
                "free":     free,
                "rate":     round(occupied / total, 4),
            }
    else:
        for zone in ZONES:
            zone_occupancy[zone] = {"total": 0, "occupied": 0, "free": 0, "rate": 0.0}

    # Compute pedestrian factor per zone
    zone_ped = {}
    if not ped_hourly.empty and "zone" in ped_hourly.columns:
        ped_by_zone = (
            ped_hourly.groupby("zone")["hourly_count"].mean().to_dict()
        )
        max_ped = max(ped_by_zone.values()) if ped_by_zone else 1
        for zone in ZONES:
            raw = ped_by_zone.get(zone, 0)
            zone_ped[zone] = round(raw / max(max_ped, 1), 4)
    else:
        for zone in ZONES:
            zone_ped[zone] = 0.0

    # Build output rows
    for zone, bounds in ZONES.items():
        occ    = zone_occupancy.get(zone, {})
        ped_f  = zone_ped.get(zone, 0.0)
        rate   = occ.get("rate", 0.0)
        score  = round(rate * 0.85 * 100 + ped_f * 0.15 * 100, 2)
        status = pressure_status(score)

        rows.append({
            "zone":             zone,
            "total_bays":       occ.get("total",    0),
            "occupied":         occ.get("occupied", 0),
            "free":             occ.get("free",     0),
            "occupancy_rate":   rate,
            "ped_factor":       ped_f,
            "pressure_score":   score,
            "pressure_status":  status,
            "zone_lat":         ZONE_CENTRES[zone][0],
            "zone_lon":         ZONE_CENTRES[zone][1],
            "computed_at":      now,
        })

    df = pd.DataFrame(rows).sort_values("pressure_score", ascending=False)
    log.info("  Zone pressure computed for %d zones", len(df))
    return df


# ===========================================================================
# MAIN
# ===========================================================================

def main(dry_run: bool = False, verbose: bool = False) -> None:
    """
    Full Epic 5 wrangling pipeline.

    Steps:
      1. Load bronze pedestrian and sensor data
      2. Clean pedestrian locations
      3. Clean and aggregate pedestrian counts
      4. Compute zone pressure scores
      5. Save silver and gold outputs
    """
    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    log.info("=" * 60)
    log.info("  Epic 5 -- Zone Pressure Data Wrangling")
    log.info("=" * 60)

    # ------------------------------------------------------------------
    # Step 1: Load
    # ------------------------------------------------------------------
    log.info("\n[1/4] Loading bronze data...")
    df_counts    = load_ped_counts()
    df_locations = load_ped_locations()
    df_sensors   = load_sensors()

    # ------------------------------------------------------------------
    # Step 2: Clean locations
    # ------------------------------------------------------------------
    log.info("\n[2/4] Cleaning pedestrian locations...")
    df_loc_clean = clean_ped_locations(df_locations)

    # ------------------------------------------------------------------
    # Step 3: Clean counts
    # ------------------------------------------------------------------
    log.info("\n[3/4] Cleaning pedestrian counts...")
    df_ped_hourly = clean_ped_counts(df_counts, df_loc_clean)

    # ------------------------------------------------------------------
    # Step 4: Compute zone pressure
    # ------------------------------------------------------------------
    log.info("\n[4/4] Computing zone pressure...")
    df_pressure = compute_zone_pressure(df_sensors, df_ped_hourly)

    # ------------------------------------------------------------------
    # Write outputs
    # ------------------------------------------------------------------
    if dry_run:
        log.info("\nDRY RUN -- no files written")
        log.info("  Ped locations clean : %d rows", len(df_loc_clean))
        log.info("  Ped hourly          : %d rows", len(df_ped_hourly))
        log.info("  Zone pressure       : %d rows", len(df_pressure))
        if not df_pressure.empty:
            log.info("\n  Zone pressure preview:")
            for _, r in df_pressure.iterrows():
                log.info(
                    "    %s -> score=%.1f  status=%s  occ=%.1f%%",
                    r["zone"], r["pressure_score"], r["pressure_status"],
                    r["occupancy_rate"] * 100,
                )
        return

    outputs = {
        SILVER_DIR / "epic5_ped_locations.parquet":   df_loc_clean if not df_loc_clean.empty else pd.DataFrame([{"note": "no location data"}]),
        SILVER_DIR / "epic5_ped_hourly.parquet":      df_ped_hourly if not df_ped_hourly.empty else pd.DataFrame([{"note": "no count data"}]),
        SILVER_DIR / "epic5_zone_pressure.parquet":   df_pressure,
        GOLD_DIR   / "epic5_zone_pressure_latest.parquet": df_pressure,
    }

    for path, df_out in outputs.items():
        df_out.to_parquet(path, index=False, engine="pyarrow")
        log.info("  Saved %s (%d rows)", path.name, len(df_out))

    # Save metadata
    meta = {
        "built_at":              datetime.now(timezone.utc).isoformat(),
        "pipeline_stage":        "silver+gold",
        "epic":                  "epic5",
        "ped_location_rows":     len(df_loc_clean),
        "ped_hourly_rows":       len(df_ped_hourly),
        "zone_pressure_rows":    len(df_pressure),
        "zones":                 list(ZONES.keys()),
    }
    meta_path = SILVER_DIR / "epic5_wrangle_metadata.json"
    meta_path.write_text(json.dumps(meta, indent=2))
    log.info("  Saved epic5_wrangle_metadata.json")

    log.info("\n" + "=" * 60)
    log.info("  Epic 5 wrangling complete")
    log.info("  Silver -> %s", SILVER_DIR)
    log.info("  Gold   -> %s", GOLD_DIR)
    log.info("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Epic 5 zone pressure data wrangling pipeline.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python scripts/wrangle_epic5.py\n"
            "  python scripts/wrangle_epic5.py --dry-run\n"
            "  python scripts/wrangle_epic5.py --verbose\n"
        ),
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview outputs without writing files.")
    parser.add_argument("--verbose", action="store_true",
                        help="Extra debug logging.")
    args = parser.parse_args()
    main(dry_run=args.dry_run, verbose=args.verbose)
