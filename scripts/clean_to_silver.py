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

JOIN STRATEGY (coverage beyond direct deviceid overlap)
---------------------------------------------------------
    Primary: sensors.bay_id LEFT JOIN restrictions.bay_id (deviceid = kerbsideid).

    CoM publishes restrictions for far fewer device ids than live sensors.
    After the direct join, we **expand** ``restrictions_long`` using
    ``parking_bays.parquet`` (``roadsegmentdescription`` + lat/lon):

      1. Street — clone slots from one representative restriction bay per street
         onto every sensor bay on that street that lacks a direct row.
      2. Nearest — remaining bays copy slots from the closest restriction bay
         within 75 m (requires scipy).

    See ``backend/app/services/restriction_coverage.py``.

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
import re
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

# Optional Epic 4 disability overlay (exported points with lat/lng)
DISABILITY_POINTS_BRONZE_CSV = BRONZE_DIR / "disability_parking.csv"

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


def _normalise_str_series(series: pd.Series) -> pd.Series:
    return series.astype(str).str.strip()


def _find_column_by_tokens(df: pd.DataFrame, required_tokens: list[str], any_tokens: list[str] | None = None) -> str | None:
    for col in df.columns:
        lower = col.lower()
        if all(token in lower for token in required_tokens):
            if any_tokens is None or any(token in lower for token in any_tokens):
                return col
    return None


def _parse_duration_from_sign_code(code: str) -> int | None:
    if not code:
        return None
    c = str(code).strip().upper()
    if c == "QP":
        return 15
    if c.startswith("LZ"):
        m = re.search(r"LZ\s*(\d+)", c)
        return int(m.group(1)) if m else None
    m = re.search(r"(\d+(?:\.\d+)?)P", c)
    if m:
        return int(float(m.group(1)) * 60)
    return None


# Sign-plate codes that describe BAY-SPECIFIC signage, not street-wide rules.
# These must NOT be fanned out across every bay on a segment.
# LZ* = Loading Zone; DP* = Disability Parking; CL = Clearway (kept — applies to whole block).
SEGMENT_EXCLUDE_PREFIXES = ("LZ", "DP")


_DAY_MAP = {"SUN": 0, "MON": 1, "TUE": 2, "WED": 3, "THU": 4, "FRI": 5, "SAT": 6}


def _parse_restriction_days(days_str: object) -> tuple[int, int] | None:
    """Parse a sign-plate day-range string into (fromday, today).

    Handles 'Mon-Fri', 'Sat', 'Sat-Sun', 'Mon-Sun', etc. Day numbering matches
    the existing restrictions dataset: Sunday=0 … Saturday=6.
    """
    if days_str is None:
        return None
    s = str(days_str).strip()
    if not s or s.lower() in {"nan", "none"}:
        return None
    parts = [p.strip().upper()[:3] for p in s.replace("–", "-").split("-")]
    if len(parts) == 1 and parts[0] in _DAY_MAP:
        d = _DAY_MAP[parts[0]]
        return (d, d)
    if len(parts) == 2 and parts[0] in _DAY_MAP and parts[1] in _DAY_MAP:
        return (_DAY_MAP[parts[0]], _DAY_MAP[parts[1]])
    return None


def _normalise_time_str(value: object) -> str | None:
    """Normalise '07:30:00' or '07:30' -> 'HH:MM'."""
    if value is None:
        return None
    s = str(value).strip()
    if not s or s.lower() in {"nan", "none"}:
        return None
    return s[:5] if len(s) >= 5 else s


def clean_disability_parking_points_csv(path: Path, verbose: bool = False) -> pd.DataFrame:
    """Clean disability parking point locations exported from Google My Maps / KML."""
    log.info("--- Cleaning disability parking points (CSV) ---")
    df = pd.read_csv(path)
    initial = len(df)

    # Normalise expected column names
    rename_map: dict[str, str] = {}
    if "latitude" in df.columns and "lat" not in df.columns:
        rename_map["latitude"] = "lat"
    if "longitude" in df.columns and "lng" not in df.columns:
        rename_map["longitude"] = "lng"
    if "lon" in df.columns and "lng" not in df.columns:
        rename_map["lon"] = "lng"
    if rename_map:
        df = df.rename(columns=rename_map)

    for c in ("name", "description"):
        if c in df.columns:
            df[c] = df[c].astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
        else:
            df[c] = None

    df["lat"] = pd.to_numeric(df.get("lat"), errors="coerce")
    df["lng"] = pd.to_numeric(df.get("lng"), errors="coerce")

    in_bounds = (
        df["lat"].between(LAT_MIN, LAT_MAX)
        & df["lng"].between(LON_MIN, LON_MAX)
        & df["lat"].notna()
        & df["lng"].notna()
    )
    df = df[in_bounds].copy()
    df["source"] = "mymaps_csv"

    # Dedup near-identical points
    df["_lat_r"] = df["lat"].round(6)
    df["_lng_r"] = df["lng"].round(6)
    df = df.drop_duplicates(subset=["name", "_lat_r", "_lng_r"], keep="first")
    df = df.drop(columns=["_lat_r", "_lng_r"]).reset_index(drop=True)

    log.info("  Disability points: %d → %d rows", initial, len(df))
    if verbose:
        log.info("  Disability points columns: %s", list(df.columns))
    return df[["name", "description", "lat", "lng", "source"]]


def clean_bays(df_raw: pd.DataFrame, verbose: bool = False) -> pd.DataFrame:
    """Clean static parking bay geometry/reference rows for Epic 4 joins."""
    log.info("--- Cleaning parking bays ---")
    df = df_raw.copy()
    initial_rows = len(df)

    if "kerbsideid" not in df.columns:
        raise KeyError("parking_bays.parquet missing kerbsideid")

    df["bay_id"] = df["kerbsideid"].astype(str).str.strip()
    df = df[
        df["bay_id"].notna()
        & (df["bay_id"] != "")
        & (df["bay_id"].str.lower() != "nan")
        & (df["bay_id"].str.lower() != "none")
    ].copy()

    lat_col = "latitude" if "latitude" in df.columns else ("lat" if "lat" in df.columns else None)
    lon_col = "longitude" if "longitude" in df.columns else ("lon" if "lon" in df.columns else ("lng" if "lng" in df.columns else None))

    if lat_col and lon_col:
        df["lat"] = pd.to_numeric(df[lat_col], errors="coerce")
        df["lon"] = pd.to_numeric(df[lon_col], errors="coerce")
    else:
        df["lat"] = pd.NA
        df["lon"] = pd.NA

    keep_cols = ["bay_id", "lat", "lon"]
    for c in ["roadsegmentid", "roadsegmentdescription", "the_geom", "geo_shape", "geo_point_2d", "location"]:
        if c in df.columns:
            keep_cols.append(c)

    out = df[keep_cols].drop_duplicates(subset=["bay_id"], keep="first").reset_index(drop=True)
    log.info("  Bays: %d → %d rows", initial_rows, len(out))
    if verbose:
        log.info("  Bays columns kept: %s", list(out.columns))
    return out


def build_accessibility_join(
    bays_clean: pd.DataFrame,
    restrictions_long: pd.DataFrame,
    sensors_clean: pd.DataFrame,
) -> pd.DataFrame:
    """Build Epic 4 silver join: bays + restrictions + latest sensor state."""
    log.info("--- Building accessibility_join silver output ---")
    out = bays_clean.merge(restrictions_long, on="bay_id", how="left")
    out = out.merge(
        sensors_clean[["bay_id", "status", "lastupdated"]],
        on="bay_id",
        how="left",
    )

    td = out["typedesc"].fillna("").astype(str).str.upper()
    out["is_disability_only"] = td.str.contains(
        r"\bDIS\b|DISABILITY|DISABLED|\bDP\b|DISAB|DISABLE",
        regex=True,
    )
    out["disabilityext_mins"] = pd.to_numeric(out.get("disabilityext_mins"), errors="coerce")
    out["has_disability_extension"] = out["disabilityext_mins"].fillna(0) > 0
    out["is_available_now"] = out["status"].astype(str).str.upper().eq("ABSENT")

    log.info("  accessibility_join rows: %d, unique bays: %d", len(out), out["bay_id"].nunique())
    return out.reset_index(drop=True)


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
    # CoM API returns location as dict, but parquet round-trips may persist JSON strings.
    def _location_to_mapping(val):
        if isinstance(val, dict):
            return val
        if isinstance(val, str) and val.strip().startswith("{"):
            try:
                parsed = json.loads(val)
                if isinstance(parsed, dict):
                    return parsed
            except json.JSONDecodeError:
                return None
        return None

    loc_map = df["location"].apply(_location_to_mapping)
    df["lat"] = df["location"].apply(
        lambda x: x.get("lat") if isinstance(x, dict) else None
    )
    df["lon"] = df["location"].apply(
        lambda x: x.get("lon") if isinstance(x, dict) else None
    )
    df["lat"] = df["lat"].where(df["lat"].notna(), loc_map.apply(lambda x: x.get("lat") if isinstance(x, dict) else None))
    df["lon"] = df["lon"].where(df["lon"].notna(), loc_map.apply(lambda x: x.get("lon") if isinstance(x, dict) else None))

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
    # CoM provides both ``typedesc{N}`` (authoritative sign-code category, e.g. "1P")
    # and ``description{N}`` (free-text sign copy).  The upstream feed occasionally
    # leaks ISO timestamps (e.g. "0001-01-08T02:00:00+00:00") into descriptionN for
    # some slots, so prefer typedescN and only fall back to descriptionN when empty.
    slot_records = []

    for _, row in df.iterrows():
        for slot_num in range(1, N_SLOTS + 1):
            typedesc = row.get(f"typedesc{slot_num}")
            if pd.isnull(typedesc) or str(typedesc).strip() == "":
                typedesc = row.get(f"description{slot_num}")

            # Skip empty slots
            if pd.isnull(typedesc) or str(typedesc).strip() == "":
                continue

            typedesc_str = str(typedesc).strip()
            if re.match(r"^\d{4}-\d{2}-\d{2}T", typedesc_str):
                raise ValueError(
                    f"typedesc looks like an ISO timestamp for "
                    f"bay_id={row['bay_id']} slot={slot_num}: {typedesc_str}"
                )

            slot_records.append({
                "bay_id":             row["bay_id"],
                "restriction_bayid":  row["restriction_bayid"],
                "slot_num":           slot_num,
                "typedesc":           typedesc_str,
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


def build_segment_restrictions(verbose: bool = False) -> tuple[pd.DataFrame, set[str]]:
    """Build restrictions via segment chain: bays -> zones_to_segments -> sign_plates."""
    log.info("--- Building segment-chain restrictions ---")
    bays = load_bronze("parking_bays.parquet").copy()
    zones = load_bronze("zones_to_segments.parquet").copy()
    signs = load_bronze("sign_plates.parquet").copy()

    if verbose:
        log.info("  zones_to_segments columns: %s", list(zones.columns))
        log.info("  sign_plates columns: %s", list(signs.columns))

    # 1) bays: bay_id + roadsegmentid
    if "kerbsideid" not in bays.columns or "roadsegmentid" not in bays.columns:
        raise KeyError("parking_bays.parquet must include kerbsideid and roadsegmentid")
    bays["bay_id"] = _normalise_str_series(bays["kerbsideid"])
    bays["roadsegmentid"] = _normalise_str_series(bays["roadsegmentid"])
    bays = bays[(bays["bay_id"] != "") & (bays["roadsegmentid"] != "")]
    bays = bays[~bays["bay_id"].isin(["nan", "none"]) & ~bays["roadsegmentid"].isin(["nan", "none"])]
    bays = bays[["bay_id", "roadsegmentid"]].drop_duplicates()

    # 2) zones_to_segments: detect segment + zone columns
    seg_col = _find_column_by_tokens(zones, ["segment", "id"])
    zone_col = _find_column_by_tokens(zones, [], ["zone", "parking"])
    if seg_col is None or zone_col is None:
        raise KeyError(f"Could not detect segment/zone columns in zones_to_segments.parquet. Columns={list(zones.columns)}")
    zones = zones.rename(columns={seg_col: "segment_id", zone_col: "parkingzone"})
    zones["segment_id"] = _normalise_str_series(zones["segment_id"])
    zones["parkingzone"] = _normalise_str_series(zones["parkingzone"])
    zones = zones[(zones["segment_id"] != "") & (zones["parkingzone"] != "")]
    zones = zones[~zones["segment_id"].isin(["nan", "none"]) & ~zones["parkingzone"].isin(["nan", "none"])]
    zones = zones[["segment_id", "parkingzone"]].drop_duplicates()

    bay_zones = bays.merge(zones, left_on="roadsegmentid", right_on="segment_id", how="inner")

    # 3) sign_plates: detect zone + restriction display columns
    sign_zone_col = _find_column_by_tokens(signs, [], ["zone", "parking"])
    code_col = _find_column_by_tokens(signs, ["code"], ["display", "restrict", "sign"]) or _find_column_by_tokens(signs, ["display"], ["code", "restrict", "sign"])
    if sign_zone_col is None or code_col is None:
        raise KeyError(f"Could not detect parking zone or restriction code columns in sign_plates.parquet. Columns={list(signs.columns)}")
    signs = signs.rename(columns={sign_zone_col: "parkingzone", code_col: "display_code"})
    signs["parkingzone"] = _normalise_str_series(signs["parkingzone"])
    signs["display_code"] = _normalise_str_series(signs["display_code"])
    signs = signs[(signs["parkingzone"] != "") & (signs["display_code"] != "")]
    signs = signs[~signs["parkingzone"].isin(["nan", "none"]) & ~signs["display_code"].isin(["nan", "none"])]

    # Detect real day/time columns. The CoM sign-plates schema uses literal names
    # `restriction_days`, `time_restrictions_start`, `time_restrictions_finish` — the
    # old token-search heuristic missed `restriction_days` and the "finish" suffix,
    # so every rule was silently defaulted. Literal lookups first, token fallback second.
    days_col = (
        "restriction_days" if "restriction_days" in signs.columns
        else _find_column_by_tokens(signs, ["restriction", "day"])
        or _find_column_by_tokens(signs, ["day"])
    )
    start_col = (
        "time_restrictions_start" if "time_restrictions_start" in signs.columns
        else _find_column_by_tokens(signs, ["start"])
    )
    end_col = (
        "time_restrictions_finish" if "time_restrictions_finish" in signs.columns
        else _find_column_by_tokens(signs, ["finish"])
        or _find_column_by_tokens(signs, ["end"])
    )
    has_time_data = all(c is not None for c in [days_col, start_col, end_col])
    if has_time_data:
        log.info("  Sign plate time columns: days=%s start=%s end=%s", days_col, start_col, end_col)
    else:
        log.warning("Sign plate day/time columns not found. Using conservative defaults (Mon-Fri 07:30-18:30).")

    joined = bay_zones.merge(signs, on="parkingzone", how="inner")

    code_map = {
        "FP1P": "1P FREE",
        "MP2P": "2P MTR",
        "MP1P": "1P MTR",
        "MP4P": "4P MTR",
        "LZ30": "LZ 30MINS",
        "QP": "P/15MINS",
        "FP": "FREE",
    }

    # Bay-specific codes (loading zone, disabled parking) must not be fanned out
    # across the whole segment — they point at individual bays only.
    skipped_bay_specific = 0
    signage_gap_bays: set[str] = set()  # bay_ids that lost an LZ/DP designation

    rows: list[dict] = []
    for _, row in joined.iterrows():
        display_code = str(row["display_code"]).strip().upper()
        if any(display_code.startswith(p) for p in SEGMENT_EXCLUDE_PREFIXES):
            skipped_bay_specific += 1
            signage_gap_bays.add(str(row["bay_id"]))
            continue

        typedesc = code_map.get(display_code, display_code)
        duration = _parse_duration_from_sign_code(display_code)

        day_range = _parse_restriction_days(row[days_col]) if has_time_data else None
        start_val = _normalise_time_str(row[start_col]) if has_time_data else None
        end_val = _normalise_time_str(row[end_col]) if has_time_data else None

        rows.append({
            "bay_id": row["bay_id"],
            # slot_num assigned incrementally per bay below
            "slot_num": None,
            "typedesc": typedesc,
            "fromday": day_range[0] if day_range is not None else 1,
            "today": day_range[1] if day_range is not None else 5,
            "starttime": start_val if start_val else "07:30",
            "endtime": end_val if end_val else "18:30",
            "duration_mins": duration,
            "disabilityext_mins": None,
        })

    if skipped_bay_specific:
        log.info("  Skipped %d bay-specific rule rows (LZ*, DP*) — not safe to fan out", skipped_bay_specific)

    segment_df = pd.DataFrame(rows)
    if len(segment_df) == 0:
        return segment_df, signage_gap_bays

    segment_df = segment_df.drop_duplicates(
        subset=["bay_id", "typedesc", "fromday", "today", "starttime", "endtime"],
        keep="first",
    ).reset_index(drop=True)

    # Each rule on a bay needs its own slot_num for the downstream schema
    segment_df["slot_num"] = segment_df.groupby("bay_id").cumcount() + 1

    # Bays that received rules via segment inheritance but still have an
    # unresolved LZ/DP plate are only partially covered.
    # Exclude bays that got non-LZ/DP rules from the signage_gap set — they
    # still need the flag because the LZ/DP plate remains unassigned.
    log.info(
        "  Segment restrictions built: %d rows across %d bays (%d bays have unresolved LZ/DP)",
        len(segment_df),
        segment_df["bay_id"].nunique(),
        len(signage_gap_bays),
    )
    return segment_df, signage_gap_bays


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
    coverage_stats: dict | None = None,
    segment_restrictions: pd.DataFrame | None = None,
    combined_restrictions: pd.DataFrame | None = None,
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
            "Segment-chain restrictions can be merged from sign plates via zones_to_segments.",
        ],
        "restriction_coverage": coverage_stats or {},
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
            "segment_restrictions_long": {
                "rows": 0 if segment_restrictions is None else len(segment_restrictions),
                "columns": [] if segment_restrictions is None else list(segment_restrictions.columns),
            },
            "combined_restrictions_long": {
                "rows": len(restrictions) if combined_restrictions is None else len(combined_restrictions),
                "columns": list(restrictions.columns) if combined_restrictions is None else list(combined_restrictions.columns),
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
    bays_raw         = load_bronze("parking_bays.parquet")

    # Clean
    sensors_clean     = clean_sensors(sensors_raw, verbose)
    restrictions_long = melt_restrictions(restrictions_raw, verbose)
    bays_clean        = clean_bays(bays_raw, verbose)

    segment_rest = None
    signage_gap_bays: set[str] = set()
    try:
        segment_rest, signage_gap_bays = build_segment_restrictions(verbose=verbose)
    except FileNotFoundError as e:
        log.warning("Segment chain data not available: %s", e)
        log.warning("Run fetch_bronze.py with zones_to_segments and sign_plates first.")
    except KeyError as e:
        log.warning("Segment chain column mapping failed: %s", e)

    if segment_rest is not None and len(segment_rest) > 0:
        # Direct (bay-specific) rules always win over segment-derived (street-level)
        # rules for the same bay. The two sources use different typedesc formats
        # (direct embeds day+time, segment is a bare code), so string-level
        # drop_duplicates can't match them — exclude at the bay level instead.
        direct_bays = set(restrictions_long["bay_id"].astype(str))
        segment_to_add = segment_rest[~segment_rest["bay_id"].astype(str).isin(direct_bays)]
        combined_restrictions = pd.concat(
            [restrictions_long, segment_to_add], ignore_index=True
        )
        log.info(
            "Combined restrictions: %d rows (%d direct + %d segment, %d segment rows suppressed by direct-rule priority)",
            len(combined_restrictions),
            len(restrictions_long),
            len(segment_to_add),
            len(segment_rest) - len(segment_to_add),
        )
    else:
        combined_restrictions = restrictions_long
        log.info("Using direct restrictions only: %d rows", len(combined_restrictions))

    # Join
    merged = join_silver(sensors_clean, combined_restrictions)
    accessibility_join = build_accessibility_join(
        bays_clean=bays_clean,
        restrictions_long=combined_restrictions,
        sensors_clean=sensors_clean,
    )

    addresses_clean = None
    streets_clean = None
    addresses_path = BRONZE_DIR / "addresses.parquet"
    if addresses_path.exists():
        addresses_raw = load_bronze("addresses.parquet")
        addresses_clean, streets_clean = clean_addresses(addresses_raw, verbose)
    else:
        log.info("No addresses.parquet found. Skipping address search datasets.")

    disability_points = None
    if DISABILITY_POINTS_BRONZE_CSV.exists():
        disability_points = clean_disability_parking_points_csv(DISABILITY_POINTS_BRONZE_CSV, verbose=verbose)
    else:
        log.info("No disability_parking.csv found in bronze. Skipping disability overlay points.")

    if dry_run:
        log.info("DRY RUN — no files written.")
        log.info("Would write:")
        log.info("  data/silver/sensors_clean.parquet      (%d rows)", len(sensors_clean))
        log.info("  data/silver/restrictions_long.parquet   (%d rows)", len(restrictions_long))
        if segment_rest is not None:
            log.info("  data/silver/segment_restrictions_long.parquet (%d rows)", len(segment_rest))
        log.info("  data/silver/signage_gap_flags.parquet  (%d bays)", len(signage_gap_bays))
        log.info("  data/silver/bays_clean.parquet         (%d rows)", len(bays_clean))
        log.info("  data/silver/accessibility_join.parquet (%d rows)", len(accessibility_join))
        log.info("  data/silver/merged.parquet              (%d rows)", len(merged))
        if addresses_clean is not None and streets_clean is not None:
            log.info("  data/silver/addresses_clean.parquet (%d rows)", len(addresses_clean))
            log.info("  data/silver/streets_clean.parquet   (%d rows)", len(streets_clean))
        if disability_points is not None:
            log.info("  data/silver/disability_parking_points_clean.parquet (%d rows)", len(disability_points))
        return

    # Save
    sensors_path = SILVER_DIR / "sensors_clean.parquet"
    sensors_clean.to_parquet(sensors_path, index=False, engine="pyarrow")
    log.info("Saved sensors_clean.parquet      (%d rows)", len(sensors_clean))

    restrictions_path = SILVER_DIR / "restrictions_long.parquet"
    restrictions_long.to_parquet(restrictions_path, index=False, engine="pyarrow")
    log.info("Saved restrictions_long.parquet  (%d rows)", len(restrictions_long))

    bays_clean_path = SILVER_DIR / "bays_clean.parquet"
    bays_clean.to_parquet(bays_clean_path, index=False, engine="pyarrow")
    log.info("Saved bays_clean.parquet         (%d rows)", len(bays_clean))

    if segment_rest is not None:
        seg_path = SILVER_DIR / "segment_restrictions_long.parquet"
        segment_rest.to_parquet(seg_path, index=False, engine="pyarrow")
        log.info("Saved segment_restrictions_long.parquet  (%d rows)", len(segment_rest))

    gap_df = pd.DataFrame({"bay_id": sorted(signage_gap_bays)})
    gap_path = SILVER_DIR / "signage_gap_flags.parquet"
    gap_df.to_parquet(gap_path, index=False, engine="pyarrow")
    log.info("Saved signage_gap_flags.parquet  (%d bays with unresolved LZ/DP)", len(gap_df))

    merged_path = SILVER_DIR / "merged.parquet"
    merged.to_parquet(merged_path, index=False, engine="pyarrow")
    log.info("Saved merged.parquet             (%d rows)", len(merged))

    accessibility_path = SILVER_DIR / "accessibility_join.parquet"
    accessibility_join.to_parquet(accessibility_path, index=False, engine="pyarrow")
    log.info("Saved accessibility_join.parquet (%d rows)", len(accessibility_join))

    if addresses_clean is not None and streets_clean is not None:
        addr_path = SILVER_DIR / "addresses_clean.parquet"
        street_path = SILVER_DIR / "streets_clean.parquet"
        addresses_clean.to_parquet(addr_path, index=False, engine="pyarrow")
        streets_clean.to_parquet(street_path, index=False, engine="pyarrow")
        log.info("Saved addresses_clean.parquet (%d rows)", len(addresses_clean))
        log.info("Saved streets_clean.parquet   (%d rows)", len(streets_clean))

    if disability_points is not None:
        dp_path = SILVER_DIR / "disability_parking_points_clean.parquet"
        disability_points.to_parquet(dp_path, index=False, engine="pyarrow")
        log.info("Saved disability_parking_points_clean.parquet (%d rows)", len(disability_points))
    write_metadata(
        sensors_clean,
        restrictions_long,
        merged,
        addresses=addresses_clean,
        streets=streets_clean,
        coverage_stats=None,
        segment_restrictions=segment_rest,
        combined_restrictions=combined_restrictions,
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
