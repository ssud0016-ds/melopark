"""
clean_to_silver.py
==================
Silver Layer — Data Cleaning & Joining
FIT5120 TE31  MeloPark  Monash University

PURPOSE
-------
Reads raw bronze Parquet files, cleans and validates each dataset,
then joins sensors <-> restrictions via bay_id to produce the silver layer.

The silver layer is "clean but not yet enriched" - it has correct
types, no nulls in key fields, and the three datasets joined into one.

REAL CoM API COLUMN NAMES (from actual API responses)
----------------------------------------------------------------
sensors.parquet:
  kerbsideid         -> renamed to bay_id (our join key)
  status_description -> 'Present' or 'Unoccupied' (normalised to Present/Absent)
  location           -> dict {'lat': float, 'lon': float} (extracted to lat/lon columns)
  lastupdated        -> ISO timestamp of last sensor reading

restrictions.parquet:
  bayid              -> kept as restriction_bayid (internal CoM bay key)
  deviceid           -> renamed to bay_id (= kerbsideid — the correct join key)
  description1..8    -> restriction sign code e.g. '2P MTR' (what we call typedesc)
  fromday1..8        -> start day of week (0=Sunday … 6=Saturday)
  today1..8          -> end day of week
  starttime1..8      -> restriction start time 'HH:MM'
  endtime1..8        -> restriction end time 'HH:MM'
  duration1..8       -> max stay in MINUTES (already minutes — do NOT multiply by 60)
  disabilityext1..8  -> disability extended time in MINUTES

WHY SILVER MATTERS
------------------
The bronze data has several known quality issues this script fixes:

1. COLUMN NAME MISMATCH
   - Sensors use kerbsideid, restrictions use bayid + deviceid
   - kerbsideid and deviceid share the same ID space (device/sensor IDs)
   - bayid is a DIFFERENT namespace — joining on it produces zero matches
   - We join on deviceid = kerbsideid (both renamed to bay_id)

2. DURATION PARSING BUG (critical — do not reintroduce)
   - Values like 120, 240 are ALREADY in minutes
   - Do NOT multiply by 60 — this was a v1 bug that caused 2hr → 120hr

3. MISSING BAY_ID
   - Some sensor records have null bay_id -> drop these rows
   - Cannot join to restrictions without bay_id

4. LOCATION AS NESTED DICT
   - sensors.location = {'lat': -37.814, 'lon': 144.965}
   - Must extract lat/lon before coordinate validation
   - Drop rows outside this range (bad GPS readings)

5. WIDE RESTRICTION COLUMNS -> LONG FORMAT
   - Raw data: one row per bay, up to 8 restriction slots as wide columns
   - The restrictions dataset has up to 8 slots per bay:
     typedesc1…8, fromday1…8, starttime1…8, endtime1…8, duration1…8
   - We MELT these into a long format: Silver: one row per (bay_id, slot_num)
   - This makes querying active slots much simpler easier in the gold layer

5. STATUS NORMALISATION
   - CoM uses 'Unoccupied' and 'Present'
   - We normalise to 'Absent' and 'Present' for consistency

JOIN STRATEGY (CORRECT PATH — no street name available)
--------------------------------------------------------
    sensors.bay_id  <->  restrictions.bay_id
    LEFT JOIN from sensors (keep all sensors even with no restriction data)
WARNINGS:
  The restrictions dataset has NO street name column.
  Do NOT filter by street name — it will return zero results.
  Correct flow: GPS lat/lon -> nearest sensor -> bay_id -> restrictions

HOW TO RUN
----------
    cd melopark/
    python scripts/clean_to_silver.py

    # Validate without writing output:
    python scripts/clean_to_silver.py --dry-run

    # Verbose column stats:
    python scripts/clean_to_silver.py --verbose

OUTPUT
------
    data/silver/sensors_clean.parquet  (cleaned sensors, one row per bay)
    data/silver/merged.parquet         (sensors joined with restrictions, long format)
    data/silver/clean_metadata.json    (row counts, join stats, cleaning summary)

DEPENDENCIES
------------
    pip install pandas pyarrow

AUTHOR : FIT5120 TE31
DATE   : 13th, April 2026
"""

import argparse
import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# ─── LOGGING ────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("clean_to_silver")

# ─── PATHS ──────────────────────────────────────────────────────────────────

ROOT       = Path(__file__).resolve().parent.parent
BRONZE_DIR = ROOT / "data" / "bronze"
SILVER_DIR = ROOT / "data" / "silver"
SILVER_DIR.mkdir(parents=True, exist_ok=True)

# ─── CONSTANTS ──────────────────────────────────────────────────────────────

#: Melbourne CBD bounding box for coordinate validation
LAT_MIN, LAT_MAX = -38.0, -37.6
LON_MIN, LON_MAX = 144.6, 145.2

#: Number of restriction slot columns in the wide restrictions dataset
N_SLOTS = 8

#: Tighter CBD bounds used for search address index
SEARCH_LAT_MIN, SEARCH_LAT_MAX = -37.825, -37.805
SEARCH_LON_MIN, SEARCH_LON_MAX = 144.950, 144.985


# ─── LOAD HELPERS ───────────────────────────────────────────────────────────

def load_bronze(filename: str) -> pd.DataFrame:
    """
    Load a bronze Parquet file with error handling.

    Parameters
    ----------
    filename : str
        Parquet filename inside data/bronze/ e.g. 'sensors.parquet'

    Returns
    -------
    pd.DataFrame
        Raw bronze data as loaded from Parquet.

    Raises
    ------
    FileNotFoundError
        If the bronze file does not exist (fetch_bronze.py not run yet).
    """
    path = BRONZE_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Bronze file not found: {path}\n"
            "Run fetch_bronze.py first."
        )
    df = pd.read_parquet(path)
    log.info("Loaded %s  ->  %d rows, %d columns", filename, len(df), len(df.columns))
    return df


# ─── SENSOR CLEANING ────────────────────────────────────────────────────────

def clean_sensors(df_raw: pd.DataFrame, verbose: bool = False) -> pd.DataFrame:
    """
    Clean the raw sensors DataFrame from bronze layer.

    The CoM sensors API returns these column names (different from docs):
      - kerbsideid        -> our standard bay_id
      - status_description -> 'Present' or 'Unoccupied'
      - location          -> dict {'lat': ..., 'lon': ...}

    Cleaning steps applied in order:
    1. Extract bay_id from kerbsideid column
    2. Drop rows with null bay_id (cannot join without it)
    3. Drop duplicate bay_ids — keep most recent by lastupdated
    4. Extract lat/lon from the nested location dictionary
    5. Convert lat/lon to numeric, drop rows outside Melbourne CBD bounds
    6. Normalise status_description -> 'Present' | 'Absent' (handle case variants)
    7. Parse lastupdated to UTC datetime
    8. Reset index

    Parameters
    ----------
    df_raw : pd.DataFrame
        Raw sensors data loaded from data/bronze/sensors.parquet
    verbose : bool
        If True, print extra stats like status value counts

    Returns
    -------
    pd.DataFrame
        Cleaned sensors with standardised column names and validated values.
        Key output columns: bay_id, lat, lon, status, lastupdated
    """
    log.info("--- Cleaning sensors ---")
    df = df_raw.copy()
    initial_rows = len(df)

    # 1. Extract bay_id from kerbsideid
    # CoM uses 'kerbsideid' — we rename to 'bay_id' as our standard join key
    df["bay_id"] = df["kerbsideid"].astype(str).str.strip()

    if verbose:
        log.info("  bay_id unique values: %d", df["bay_id"].nunique())

    # 2. Drop null bay_id
    null_bay = df["bay_id"].isnull() | (df["bay_id"] == "nan") | (df["bay_id"] == "")
    dropped_null = null_bay.sum()
    df = df[~null_bay]
    if dropped_null > 0:
        log.warning("  Dropped %d rows with null bay_id", dropped_null)

    # 3. Drop duplicates — keep most recent sensor reading
    if "lastupdated" in df.columns:
        df = df.sort_values("lastupdated", ascending=False)
    dup_count = df.duplicated("bay_id").sum()
    df = df.drop_duplicates("bay_id", keep="first")
    if dup_count > 0:
        log.info("  Dropped %d duplicate bay_id rows (kept latest)", dup_count)

    # 4. Extract lat/lon from nested location dictionary
    # CoM API returns location as: {'lat': -37.814, 'lon': 144.965}
    df["lat"] = df["location"].apply(
        lambda x: x.get("lat") if isinstance(x, dict) else None
    )
    df["lon"] = df["location"].apply(
        lambda x: x.get("lon") if isinstance(x, dict) else None
    )

    # 5. Validate coordinates — filter to Melbourne CBD bounding box
    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lon"] = pd.to_numeric(df["lon"], errors="coerce")

    out_of_bounds = (
        (df["lat"] < LAT_MIN) | (df["lat"] > LAT_MAX) |
        (df["lon"] < LON_MIN) | (df["lon"] > LON_MAX) |
        df["lat"].isnull() | df["lon"].isnull()
    )
    dropped_coords = out_of_bounds.sum()
    df = df[~out_of_bounds]
    if dropped_coords > 0:
        log.warning("  Dropped %d rows with invalid coordinates", dropped_coords)

    # 6. Normalise status
    # CoM uses 'Unoccupied' (bay is free) and 'Present' (vehicle detected)
    # We normalise to 'Absent' and 'Present' for clarity
    df["status"] = (
        df["status_description"]
        .astype(str)
        .str.strip()
        .replace({
            "Unoccupied": "Absent",
            "Present":    "Present",
            "Occupied":   "Present",
        })
    )
    # Set any unexpected values to Absent (safe default)
    df.loc[~df["status"].isin(["Present", "Absent"]), "status"] = "Absent"

    if verbose:
        log.info("  Status distribution:\n%s", df["status"].value_counts().to_string())

    # 7. Parse lastupdated to UTC datetime
    if "lastupdated" in df.columns:
        df["lastupdated"] = pd.to_datetime(df["lastupdated"], utc=True, errors="coerce")

    # 8. Reset index
    df = df.reset_index(drop=True)

    final_rows = len(df)
    log.info(
        "  Sensors: %d → %d rows (dropped %d = %.1f%%)",
        initial_rows, final_rows,
        initial_rows - final_rows,
        100 * (initial_rows - final_rows) / max(initial_rows, 1),
    )
    return df


# ─── RESTRICTION CLEANING + MELTING ─────────────────────────────────────────

def _parse_duration(val) -> int | None:
    """
    Parse a restriction duration value into minutes.

    CRITICAL: CoM duration values are ALREADY in minutes.
    A value of 120 means 120 minutes (2 hours) — do NOT multiply by 60.
    This was a bug in v1 of the pipeline that caused 2hr -> 120min.

    Parameters
    ----------
    val : any
        Raw value from the CoM dataset. May be int, float, str, or NaN.

    Returns
    -------
    int | None
        Duration in minutes, or None if the value cannot be parsed.

    Examples
    --------
    >>> _parse_duration(120)
    120
    >>> _parse_duration(60.0)
    60
    >>> _parse_duration(None)
    None
    >>> _parse_duration('2P')
    2
    """
    if pd.isnull(val):
        return None
    try:
        minutes = int(float(str(val).replace("P", "").strip()))
        # Reject implausibly large values (> 24 hours)
        return minutes if minutes <= 1440 else None
    except (ValueError, TypeError):
        return None


def melt_restrictions(df_raw: pd.DataFrame, verbose: bool = False) -> pd.DataFrame:
    """
    Clean and melt the wide restrictions DataFrame into long format.

    The CoM restrictions API uses different column names than expected:
      - bayid        -> kept as restriction_bayid (CoM internal key, different namespace)
      - deviceid     -> renamed to bay_id (= kerbsideid — our join key to sensors)
      - description1..8 -> restriction sign code (we store as typedesc)
      - fromday1..8  -> start day of week (0=Sunday … 6=Saturday)
      - today1..8    -> end day of week
      - starttime1..8 -> restriction start time 'HH:MM'
      - endtime1..8  → restriction end time 'HH:MM'
      - duration1..8 -> max stay in MINUTES (already minutes)
      - disabilityext1..8 -> disability extended time in MINUTES

    The wide format (1 row × 8 slot columns) is melted to long format
    (N rows × 1 slot per row) for easier querying.

    Parameters
    ----------
    df_raw : pd.DataFrame
        Raw restrictions data from data/bronze/restrictions.parquet
    verbose : bool
        If True, print slot expansion stats

    Returns
    -------
    pd.DataFrame
        Long-format restrictions with columns:
        bay_id, restriction_bayid, slot_num, typedesc, fromday, today,
        starttime, endtime, duration_mins, disabilityext_mins
    """
    log.info("--- Cleaning restrictions ---")
    df = df_raw.copy()
    initial_rows = len(df)

    # deviceid is the correct join key (= kerbsideid in the sensor namespace).
    # bayid is a DIFFERENT CoM-internal namespace that does NOT match sensors.
    if "deviceid" not in df.columns:
        log.error(
            "  'deviceid' column missing from restrictions bronze data. "
            "Re-fetch bronze data with the latest fetch_bronze.py."
        )
        raise KeyError("deviceid column required in restrictions data")

    df["bay_id"] = df["deviceid"].astype(str).str.strip()
    df["restriction_bayid"] = df["bayid"].astype(str).str.strip()

    # Drop null bay_id (missing deviceid)
    null_bay = df["bay_id"].isnull() | (df["bay_id"] == "nan") | (df["bay_id"] == "")
    dropped_null = null_bay.sum()
    df = df[~null_bay]
    if dropped_null > 0:
        log.warning("  Dropped %d rows with null deviceid", dropped_null)

    log.info(
        "  Restrictions: %d rows, %d unique deviceids (bay_id), %d unique bayids",
        len(df), df["bay_id"].nunique(), df["restriction_bayid"].nunique(),
    )

    # Melt wide → long (one row per restriction slot)
    # CoM uses description1..8 for the sign code (not typedesc1..8)
    slot_records = []

    for _, row in df.iterrows():
        for slot_num in range(1, N_SLOTS + 1):
            typedesc = row.get(f"description{slot_num}")

            # Skip empty slots
            if pd.isnull(typedesc) or str(typedesc).strip() == "":
                continue

            slot_records.append({
                "bay_id":             row["bay_id"],
                "restriction_bayid":  row["restriction_bayid"],
                "slot_num":           slot_num,
                "typedesc":           str(typedesc).strip(),
                "fromday":            int(row.get(f"fromday{slot_num}")) if pd.notna(row.get(f"fromday{slot_num}")) else None,
                "today":              int(row.get(f"today{slot_num}"))   if pd.notna(row.get(f"today{slot_num}"))   else None,
                "starttime":          str(row.get(f"starttime{slot_num}")).strip() if pd.notna(row.get(f"starttime{slot_num}")) else None,
                "endtime":            str(row.get(f"endtime{slot_num}")).strip()   if pd.notna(row.get(f"endtime{slot_num}"))   else None,
                # Duration already in minutes — do NOT multiply by 60
                "duration_mins":      _parse_duration(row.get(f"duration{slot_num}")),
                "disabilityext_mins": _parse_duration(row.get(f"disabilityext{slot_num}")),
            })

    long_df = pd.DataFrame(slot_records)

    if verbose:
        log.info("  Wide rows:  %d", initial_rows)
        log.info("  Long rows:  %d (%.1fx expansion)", len(long_df), len(long_df) / max(initial_rows, 1))
        log.info("  Unique bay_ids: %d", long_df["bay_id"].nunique())

    long_df = long_df.reset_index(drop=True)
    log.info(
        "  Restrictions long format: %d slots for %d bays",
        len(long_df), long_df["bay_id"].nunique()
    )
    return long_df


# ─── ADDRESS CLEANING (SEARCH INDEX) ────────────────────────────────────────

def _pick_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    """Return the first matching column from a candidate list."""
    for col in candidates:
        if col in df.columns:
            return col
    return None


def _as_mapping(val) -> dict | None:
    """Parse API geo objects from dicts or JSON strings (after bronze Parquet round-trip)."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    if isinstance(val, dict):
        return val
    if isinstance(val, str) and val.strip().startswith("{"):
        try:
            parsed = json.loads(val)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            return None
    return None


def _lat_lng_from_geo_cell(val) -> tuple:
    m = _as_mapping(val)
    if not m:
        return (None, None)
    return (m.get("lat"), m.get("lon"))


def clean_addresses(df_raw: pd.DataFrame, verbose: bool = False) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Clean raw address data into search-ready rows.

    Returns
    -------
    tuple[pd.DataFrame, pd.DataFrame]
        - addresses_df with columns: name, sub, category, lat, lng
        - streets_df with columns: name, sub, category, lat, lng
    """
    log.info("--- Cleaning addresses ---")
    df = df_raw.copy()
    initial_rows = len(df)

    geo_col = _pick_column(df, ["geo_point_2d", "location", "geo_shape"])
    lat_col = _pick_column(df, ["latitude", "lat", "y"])
    lon_col = _pick_column(df, ["longitude", "lon", "lng", "x"])

    if (lat_col is None or lon_col is None) and geo_col:
        latlng = df[geo_col].apply(_lat_lng_from_geo_cell)
        df["lat"] = latlng.apply(lambda t: t[0])
        df["lng"] = latlng.apply(lambda t: t[1])
    elif lat_col and lon_col:
        df["lat"] = pd.to_numeric(df[lat_col], errors="coerce")
        df["lng"] = pd.to_numeric(df[lon_col], errors="coerce")
    else:
        raise ValueError(
            "Could not detect latitude/longitude columns in addresses dataset. "
            f"Available columns: {list(df.columns)}"
        )

    df["lat"] = pd.to_numeric(df["lat"], errors="coerce")
    df["lng"] = pd.to_numeric(df["lng"], errors="coerce")

    in_cbd = (
        df["lat"].between(SEARCH_LAT_MIN, SEARCH_LAT_MAX)
        & df["lng"].between(SEARCH_LON_MIN, SEARCH_LON_MAX)
        & df["lat"].notna()
        & df["lng"].notna()
    )
    df = df[in_cbd].copy()

    if verbose:
        log.info("  Address columns: %s", list(df.columns))
    log.info("  CBD filter: %d -> %d rows", initial_rows, len(df))

    addr_col = _pick_column(
        df,
        ["add_comp", "address_pnt", "address", "street_address", "full_address", "streetaddress"],
    )
    house_col = _pick_column(df, ["street_no", "housenumber", "house_number", "street_number"])
    street_col = _pick_column(df, ["str_name", "streetname", "street_name", "road_name"])
    street_type_col = _pick_column(df, ["streettype", "street_type", "road_type"])
    suburb_col = _pick_column(df, ["suburb", "locality", "city"])
    postcode_col = _pick_column(df, ["postcode", "post_code", "postal_code"])

    if addr_col:
        df["name"] = df[addr_col].astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
    elif street_col:
        house_series = df[house_col].fillna("").astype(str).str.strip() if house_col else ""
        street_series = df[street_col].fillna("").astype(str).str.strip()
        street_type_series = (
            " " + df[street_type_col].fillna("").astype(str).str.strip()
            if street_type_col else ""
        )
        df["name"] = (
            house_series + " " + street_series + street_type_series
            if house_col else street_series + street_type_series
        ).str.replace(r"\s+", " ", regex=True).str.strip()
    else:
        raise ValueError(
            "Could not detect address/street columns to build searchable name. "
            f"Available columns: {list(df.columns)}"
        )

    sub_parts: list[pd.Series] = []
    if suburb_col:
        sub_parts.append(df[suburb_col].fillna("").astype(str).str.strip())
    if postcode_col:
        sub_parts.append(df[postcode_col].fillna("").astype(str).str.strip())

    if sub_parts:
        sub = sub_parts[0]
        for part in sub_parts[1:]:
            sub = (sub + " " + part).str.replace(r"\s+", " ", regex=True).str.strip()
        df["sub"] = sub
    else:
        df["sub"] = "Melbourne VIC"

    df = df[df["name"] != ""].copy()
    df["category"] = "address"
    addresses_df = df[["name", "sub", "category", "lat", "lng"]].drop_duplicates(
        subset=["name", "lat", "lng"]
    ).reset_index(drop=True)

    if street_col:
        street_name = df[street_col].fillna("").astype(str).str.strip()
        if street_type_col:
            street_name = (street_name + " " + df[street_type_col].fillna("").astype(str).str.strip()).str.strip()
        street_name = street_name.str.replace(r"\s+", " ", regex=True).str.title()

        tmp = df.copy()
        tmp["_street_name"] = street_name
        tmp = tmp[tmp["_street_name"] != ""]
        streets_df = (
            tmp.groupby("_street_name", as_index=False)
            .agg(lat=("lat", "mean"), lng=("lng", "mean"), count=("lat", "size"))
        )
        streets_df = streets_df[streets_df["count"] >= 2].copy()
        streets_df["name"] = streets_df["_street_name"]
        streets_df["sub"] = "Melbourne CBD"
        streets_df["category"] = "street"
        streets_df = streets_df[["name", "sub", "category", "lat", "lng"]].reset_index(drop=True)
    else:
        streets_df = pd.DataFrame(columns=["name", "sub", "category", "lat", "lng"])

    log.info("  Address rows: %d", len(addresses_df))
    log.info("  Street rows:  %d", len(streets_df))
    return addresses_df, streets_df


# ─── JOIN ────────────────────────────────────────────────────────────────────

def join_silver(
    sensors: pd.DataFrame,
    restrictions_long: pd.DataFrame
) -> pd.DataFrame:
    """
    Join cleaned sensors with long-format restrictions on bay_id.

    Join type: LEFT JOIN from sensors -> restrictions.
    All sensors are kept even if they have no restriction data.
    Sensors without restrictions get null restriction columns.

    The resulting merged DataFrame is the silver layer — it contains
    everything needed to build the gold layer enrichment.

    Output columns include:
      bay_id, lat, lon, status, lastupdated,  (from sensors)
      slot_num, typedesc, fromday, today,     (from restrictions)
      starttime, endtime, duration_mins,      (from restrictions)
      disabilityext_mins                      (from restrictions)

    Parameters
    ----------
    sensors : pd.DataFrame
        Cleaned sensors, one row per bay
    restrictions_long : pd.DataFrame
        Long-format restrictions, N rows per bay

    Returns
    -------
    pd.DataFrame
        Merged silver DataFrame ready for gold layer enrichment
    """
    log.info("--- Joining sensors <-> restrictions on bay_id ---")

    sensors_bays     = set(sensors["bay_id"].unique())
    restriction_bays = set(restrictions_long["bay_id"].unique())
    matched          = sensors_bays & restriction_bays
    unmatched        = sensors_bays - restriction_bays

    log.info("  Sensor bay_ids:      %d", len(sensors_bays))
    log.info("  Restriction bay_ids: %d", len(restriction_bays))
    log.info("  Matched:             %d (%.1f%%)",
             len(matched), 100 * len(matched) / max(len(sensors_bays), 1))

    if unmatched:
        log.warning(
            "  %d sensor bays have no restriction data (null in silver)",
            len(unmatched)
        )

    merged = sensors.merge(
        restrictions_long,
        on="bay_id",
        how="left",
        suffixes=("_sensor", "_restriction"),
    )

    merged["_silver_joined_at"] = datetime.now(timezone.utc).isoformat()
    merged = merged.reset_index(drop=True)

    log.info("  Silver merged rows: %d", len(merged))
    return merged


# ─── METADATA ───────────────────────────────────────────────────────────────

def write_metadata(
    sensors: pd.DataFrame,
    restrictions: pd.DataFrame,
    merged: pd.DataFrame,
    addresses: pd.DataFrame | None = None,
    streets: pd.DataFrame | None = None,
) -> None:
    """
    Write silver layer metadata JSON for audit and downstream use.

    Parameters
    ----------
    sensors : pd.DataFrame
    restrictions : pd.DataFrame
    merged : pd.DataFrame
    """
    meta = {
        "pipeline_stage": "silver",
        "cleaned_at":     datetime.now(timezone.utc).isoformat(),
        "notes": [
            "CoM sensors use kerbsideid (not bay_id) and status_description (not status).",
            "CoM restrictions use bayid (internal key) + deviceid (= kerbsideid).",
            "Join key: restrictions.deviceid = sensors.kerbsideid (both → bay_id).",
            "bayid is a DIFFERENT namespace — do NOT join on it (produces false matches).",
            "Duration values are in MINUTES. Do NOT multiply by 60.",
            "location column is a dict — lat/lon extracted before coordinate validation.",
            "Restrictions melted from wide (description1..8) to long (one row per slot).",
            "No street name in restrictions — use GPS lat/lon → nearest sensor → bay_id.",
        ],
        "datasets": {
            "sensors_clean": {
                "rows":    len(sensors),
                "columns": list(sensors.columns),
            },
            "restrictions_long": {
                "rows":    len(restrictions),
                "columns": list(restrictions.columns),
            },
            "merged": {
                "rows":        len(merged),
                "columns":     list(merged.columns),
                "unique_bays": int(merged["bay_id"].nunique()),
            },
        },
    }

    if addresses is not None:
        meta["datasets"]["addresses_clean"] = {
            "rows": len(addresses),
            "columns": list(addresses.columns),
        }
    if streets is not None:
        meta["datasets"]["streets_clean"] = {
            "rows": len(streets),
            "columns": list(streets.columns),
        }

    path = SILVER_DIR / "clean_metadata.json"
    with open(path, "w") as f:
        json.dump(meta, f, indent=2)

    log.info("Metadata → %s", path.name)


# ─── MAIN ────────────────────────────────────────────────────────────────────

def main(dry_run: bool = False, verbose: bool = False) -> None:
    """
    Run the full bronze -> silver cleaning pipeline.

    Parameters
    ----------
    dry_run : bool
        If True, run all cleaning but do not write output files.
        Useful for validating the pipeline without side effects.
    verbose : bool
        If True, print detailed column statistics at each step.
    """
    log.info("=" * 60)
    log.info("MeloPark — Silver Layer Cleaning")
    log.info("Input:  %s", BRONZE_DIR)
    log.info("Output: %s", SILVER_DIR)
    log.info("=" * 60)

    # Load bronze
    sensors_raw      = load_bronze("sensors.parquet")
    restrictions_raw = load_bronze("restrictions.parquet")

    # Clean
    sensors_clean     = clean_sensors(sensors_raw, verbose)
    restrictions_long = melt_restrictions(restrictions_raw, verbose)

    # Join
    merged = join_silver(sensors_clean, restrictions_long)

    addresses_clean = None
    streets_clean = None
    addresses_path = BRONZE_DIR / "addresses.parquet"
    if addresses_path.exists():
        addresses_raw = load_bronze("addresses.parquet")
        addresses_clean, streets_clean = clean_addresses(addresses_raw, verbose)
    else:
        log.info("No addresses.parquet found. Skipping address search datasets.")

    if dry_run:
        log.info("DRY RUN — no files written.")
        log.info("Would write:")
        log.info("  data/silver/sensors_clean.parquet      (%d rows)", len(sensors_clean))
        log.info("  data/silver/restrictions_long.parquet   (%d rows)", len(restrictions_long))
        log.info("  data/silver/merged.parquet              (%d rows)", len(merged))
        if addresses_clean is not None and streets_clean is not None:
            log.info("  data/silver/addresses_clean.parquet (%d rows)", len(addresses_clean))
            log.info("  data/silver/streets_clean.parquet   (%d rows)", len(streets_clean))
        return

    # Save
    sensors_path = SILVER_DIR / "sensors_clean.parquet"
    sensors_clean.to_parquet(sensors_path, index=False, engine="pyarrow")
    log.info("Saved sensors_clean.parquet      (%d rows)", len(sensors_clean))

    restrictions_path = SILVER_DIR / "restrictions_long.parquet"
    restrictions_long.to_parquet(restrictions_path, index=False, engine="pyarrow")
    log.info("Saved restrictions_long.parquet  (%d rows)", len(restrictions_long))

    merged_path = SILVER_DIR / "merged.parquet"
    merged.to_parquet(merged_path, index=False, engine="pyarrow")
    log.info("Saved merged.parquet             (%d rows)", len(merged))

    if addresses_clean is not None and streets_clean is not None:
        addr_path = SILVER_DIR / "addresses_clean.parquet"
        street_path = SILVER_DIR / "streets_clean.parquet"
        addresses_clean.to_parquet(addr_path, index=False, engine="pyarrow")
        streets_clean.to_parquet(street_path, index=False, engine="pyarrow")
        log.info("Saved addresses_clean.parquet (%d rows)", len(addresses_clean))
        log.info("Saved streets_clean.parquet   (%d rows)", len(streets_clean))

    write_metadata(
        sensors_clean,
        restrictions_long,
        merged,
        addresses=addresses_clean,
        streets=streets_clean,
    )

    log.info("=" * 60)
    log.info("Silver layer complete.")
    log.info("  Sensors:      %d rows", len(sensors_clean))
    log.info("  Restrictions: %d rows (long format)", len(restrictions_long))
    log.info("  Merged:       %d rows", len(merged))
    log.info("=" * 60)


# ─── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="MeloPark Silver Layer — Clean and join bronze data",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/clean_to_silver.py                # full clean
  python scripts/clean_to_silver.py --dry-run      # validate without writing
  python scripts/clean_to_silver.py --verbose      # detailed column stats
        """,
    )
    parser.add_argument("--dry-run", action="store_true", help="Run without saving files")
    parser.add_argument("--verbose", action="store_true", help="Print detailed stats")
    args = parser.parse_args()
    main(dry_run=args.dry_run, verbose=args.verbose)
