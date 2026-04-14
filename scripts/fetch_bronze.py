"""
fetch_bronze.py
===============
Bronze Layer - Raw Data Ingestion
FIT5120 TE31 - MelOPark - Monash University

PURPOSE
-------
Fetches raw data from the City of Melbourne (CoM) Open Data API
and saves it as-is to the data/bronze/ directory with no transformations.

The bronze layer is the "landing zone" - it preserves exactly what
the API returned, allowing full re-processing if cleaning logic changes.

THREE DATASETS FETCHED
-----------------------
1. on-street-parking-bay-sensors
   - Live in-ground sensor readings (is a vehicle present?)
   - Key fields: bay_id (KerbsideID), location(lat, lon), status_description(Present/Unoccupied), lastupdated
   - Join key: bay_id  -> links to restrictions

2. on-street-car-park-bay-restrictions
   - Restriction rules per bay (typedesc, times, days, duration)
   - Key fields: bay_id, typedesc1..8, disabilityext1..8, duration1..8, fromday1..8, starttime1..8,
                 endtime1..8 
   - Join key: bay_id  -> links to sensors
   - NO street name column - cannot filter by street name

3. on-street-parking-bays
   - Spatial polygons for each physical bay
   - Key fields: marker_id(KerbsideID), the_geom (WGS84 polygon)
   - Join key: marker_id -> links to sensors (NOT to restrictions directly)

API DOCUMENTATION
-----------------
Base URL : https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/
Auth     : None required (public open data, CC BY licence)
Format   : JSON
Pagination: offset and limit (max 100 per request, loop until exhausted)

HOW TO RUN
----------
    cd melopark/
    python scripts/fetch_bronze.py

    # Fetch only sensors (faster, for testing):
    python scripts/fetch_bronze.py --dataset sensors

    # Fetch all with verbose logging:
    python scripts/fetch_bronze.py --verbose

OUTPUT
------
    data/bronze/sensors.parquet          (~4,263 rows)
    data/bronze/restrictions.parquet     (~4,263 rows)
    data/bronze/parking_bays.parquet     (~4,500+ rows)
    data/bronze/fetch_metadata.json      (run timestamp, row counts, API version)

DEPENDENCIES
------------
    pip install requests pandas pyarrow tqdm

AUTHOR : FIT5120 TE31
DATE   : 13 April,2026
"""

import argparse
import json
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests
from tqdm import tqdm

# ─── LOGGING ────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("fetch_bronze")

# ─── PATHS ──────────────────────────────────────────────────────────────────

ROOT        = Path(__file__).resolve().parent.parent
BRONZE_DIR  = ROOT / "data" / "bronze"
BRONZE_DIR.mkdir(parents=True, exist_ok=True)

# ─── API CONFIGURATION ──────────────────────────────────────────────────────

API_BASE = (
    "https://data.melbourne.vic.gov.au"
    "/api/explore/v2.1/catalog/datasets"
)

#: Max records per API page (CoM limit is 100)
PAGE_SIZE = 100

#: Seconds to wait between paginated requests (to avoid hitting rate limits)
REQUEST_DELAY = 0.25

#: Seconds before a single request times out (avoid hanging if API is unresponsive)
REQUEST_TIMEOUT = 30

DATASETS = {
    "sensors": {
        "id":   "on-street-parking-bay-sensors",
        "desc": "Live in-ground parking sensors (Present/Absent per bay)",
        "out":  "sensors.parquet",
        "key":  "bay_id",
    },
    "restrictions": {
        "id":   "on-street-car-park-bay-restrictions",
        "desc": "Parking restriction rules per bay (typedesc, times, days)",
        "out":  "restrictions.parquet",
        "key":  "bay_id",
    },
    "bays": {
        "id":   "on-street-parking-bays",
        "desc": "Spatial polygon boundaries for each physical bay",
        "out":  "parking_bays.parquet",
        "key":  "marker_id",
        "max_rows": 5000,
    },
}


# ─── FETCH HELPERS ──────────────────────────────────────────────────────────

def fetch_page(dataset_id: str, offset: int, limit: int = PAGE_SIZE) -> dict:
    """
    Fetch a single page of records from the CoM Open Data API.

    Parameters
    ----------
    dataset_id : str
        CoM dataset identifier e.g. 'on-street-parking-bay-sensors'
    offset : int
        Zero-based record offset for pagination
    limit : int
        Number of records to return (max 100)

    Returns
    -------
    dict
        Raw JSON response with keys 'total_count' and 'results'

    Raises
    ------
    requests.HTTPError
        If the API returns a non-2xx status code
    requests.Timeout
        If the request exceeds REQUEST_TIMEOUT seconds
    """
    url    = f"{API_BASE}/{dataset_id}/records"
    params = {"limit": limit, "offset": offset}

    response = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()


def fetch_all_records(dataset_id: str, desc: str, verbose: bool = False) -> pd.DataFrame:
    """
    Paginate through all records of a CoM dataset and return a DataFrame.

    Handles pagination automatically. Logs progress every 1,000 records.
    Adds a bronze metadata column ``_fetched_at`` (UTC ISO timestamp).

    Parameters
    ----------
    dataset_id : str
        CoM dataset identifier
    desc : str
        Human-readable description for logging
    verbose : bool
        If True, log each page fetch

    Returns
    -------
    pd.DataFrame
        All records concatenated into a single DataFrame.
        Returns empty DataFrame if API returns no results.
    """
    log.info("Fetching: %s", desc)
    log.info("Dataset : %s", dataset_id)

    # First request to get total count
    first_page = fetch_page(dataset_id, offset=0)
    total      = first_page.get("total_count", 0)
    log.info("Total records: %d", total)

    if total == 0:
        log.warning("No records returned for %s", dataset_id)
        return pd.DataFrame()

    records = list(first_page.get("results", []))
    time.sleep(REQUEST_DELAY)

    # Paginate remaining pages
    offsets    = range(PAGE_SIZE, min(total, 10000), PAGE_SIZE)
    progressbar = tqdm(offsets, desc=f"  Pages", unit="page", disable=not verbose)

    for offset in progressbar:
        page = fetch_page(dataset_id, offset)
        records.extend(page.get("results", []))
        time.sleep(REQUEST_DELAY)

    log.info("Retrieved %d records", len(records))

    df = pd.DataFrame(records)

    # Add bronze metadata column — when was this data fetched?
    df["_fetched_at"] = datetime.now(timezone.utc).isoformat()

    return df


# ─── SAVE HELPER ────────────────────────────────────────────────────────────

def save_parquet(df: pd.DataFrame, filename: str, description: str) -> Path:
    """
    Save a DataFrame to the bronze directory as a Parquet file.

    Parquet is preferred over CSV because:
    - Preserves column dtypes (avoids re-parsing on load)
    - ~5–10× smaller than equivalent CSV
    - Faster read/write for large datasets

    Parameters
    ----------
    df : pd.DataFrame
    filename : str   e.g. 'sensors.parquet'
    description : str  used in log messages

    Returns
    -------
    Path  Absolute path to the saved file.
    """
    path = BRONZE_DIR / filename
    df.to_parquet(path, index=False, engine="pyarrow")
    size_kb = path.stat().st_size / 1024
    log.info("Saved %s  →  %s  (%.1f KB, %d rows)", description, path.name, size_kb, len(df))
    return path


# ─── METADATA ───────────────────────────────────────────────────────────────

def write_metadata(results: dict) -> None:
    """
    Write a JSON metadata file recording what was fetched and when.

    This lets downstream scripts (clean_to_silver.py) know:
    - When the bronze data was last refreshed
    - How many rows each dataset had
    - The API version used

    Parameters
    ----------
    results : dict
        Dict of {dataset_name: {rows: int, path: str, fetched_at: str}}
    """
    meta = {
        "pipeline_stage":  "bronze",
        "fetched_at":       datetime.now(timezone.utc).isoformat(),
        "api_base":         API_BASE,
        "api_licence":      "CC BY - City of Melbourne Open Data",
        "api_portal":       "https://data.melbourne.vic.gov.au",
        "datasets":         results,
        "notes": [
            "Bronze data is raw - no transformations applied.",
            "bay_id joins sensors <-> restrictions.",
            "marker_id joins sensors <-> parking_bays.",
            "Restrictions dataset has NO street name column.",
            "Use GPS lat/lon -> nearest sensor -> bay_id to look up restrictions.",
        ],
    }

    meta_path = BRONZE_DIR / "fetch_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    log.info("Metadata written → %s", meta_path.name)


# ─── MAIN ───────────────────────────────────────────────────────────────────

def main(datasets_to_fetch: list[str], verbose: bool = False) -> None:
    """
    Fetch requested datasets from CoM API and save to bronze layer.

    Parameters
    ----------
    datasets_to_fetch : list[str]
        One or more of: 'sensors', 'restrictions', 'bays'
    verbose : bool
        Enable detailed progress logging
    """
    log.info("=" * 60)
    log.info("MeloPark — Bronze Layer Ingestion")
    log.info("Output: %s", BRONZE_DIR)
    log.info("=" * 60)

    results    = {}
    start_time = time.perf_counter()

    for key in datasets_to_fetch:
        cfg = DATASETS.get(key)
        if not cfg:
            log.error("Unknown dataset key: %s. Choose from: %s", key, list(DATASETS))
            sys.exit(1)

        try:
            df   = fetch_all_records(cfg["id"], cfg["desc"], verbose)
            path = save_parquet(df, cfg["out"], cfg["desc"])

            results[key] = {
                "dataset_id":  cfg["id"],
                "description": cfg["desc"],
                "output_file": str(path),
                "rows":        len(df),
                "columns":     list(df.columns),
                "fetched_at":  df["_fetched_at"].iloc[0] if len(df) else None,
            }

            log.info("Done: %s (%d rows)\n", key, len(df))

        except requests.HTTPError as exc:
            log.error("HTTP error fetching %s: %s", key, exc)
            sys.exit(1)
        except requests.Timeout:
            log.error("Timeout fetching %s (waited %ds)", key, REQUEST_TIMEOUT)
            sys.exit(1)

    write_metadata(results)

    elapsed = time.perf_counter() - start_time
    log.info("=" * 60)
    log.info("Bronze ingestion complete in %.1fs", elapsed)
    total_rows = sum(v["rows"] for v in results.values())
    log.info("Total rows fetched: %d", total_rows)
    log.info("=" * 60)


# ─── CLI ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="MeloPark Bronze Layer — Fetch raw data from CoM API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/fetch_bronze.py                     # fetch all 3 datasets
  python scripts/fetch_bronze.py --dataset sensors   # sensors only
  python scripts/fetch_bronze.py --verbose            # detailed progress
        """,
    )

    parser.add_argument(
        "--dataset",
        choices=list(DATASETS.keys()),
        help="Fetch only one dataset (default: all)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show page-by-page progress bars",
    )

    args = parsed = parser.parse_args()

    to_fetch = [args.dataset] if args.dataset else list(DATASETS.keys())
    main(to_fetch, verbose=args.verbose)
