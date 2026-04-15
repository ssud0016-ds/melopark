"""
fetch_bronze.py - Downloads raw data from City of Melbourne APIs
and saves to data/bronze/ as Parquet files without any transformation.

PURPOSE
-------
Fetches raw data from the City of Melbourne (CoM) Open Data API and saves
it as-is to the data/bronze/ directory with no transformations.

DATASETS FETCHED
----------------
1. on-street-parking-bay-sensors — live sensor readings per bay
2. on-street-car-park-bay-restrictions — restriction rules per bay
3. on-street-parking-bays — bay polygons (geometry)
4. street-addresses — geocoded addresses (search index input)

Usage:
    python scripts/fetch_bronze.py

This pulls:
    1. Live sensor data (snapshot)
    2. Parking bays (static, full export)
    3. Bay restrictions (static, full export)
    4. Street addresses (static, full export, for search)

Output:
    data/bronze/sensors.parquet
    data/bronze/restrictions.parquet
    data/bronze/parking_bays.parquet
    data/bronze/addresses.parquet
    data/bronze/fetch_metadata.json
"""

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("fetch_bronze")

ROOT = Path(__file__).resolve().parent.parent
BASE_DIR = ROOT / "data" / "bronze"

API_BASE = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"

DATASETS = {
    "sensors": {
        "dataset_id": "on-street-parking-bay-sensors",
        "description": "Live sensor snapshot — occupancy per bay",
        "output_file": "sensors.parquet",
    },
    "restrictions": {
        "dataset_id": "on-street-car-park-bay-restrictions",
        "description": "Static restriction rules per bay (up to 8 slots)",
        "output_file": "restrictions.parquet",
    },
    "bays": {
        "dataset_id": "on-street-parking-bays",
        "description": "Spatial polygon boundaries for each physical bay",
        "output_file": "parking_bays.parquet",
    },
    "addresses": {
        "dataset_id": "street-addresses",
        "description": "City of Melbourne street/property addresses for search",
        "output_file": "addresses.parquet",
    },
}

MAX_API_OFFSET = 10_000
PAGE_SIZE = 100


def fetch_dataset(name: str, config: dict) -> list[dict]:
    """Paginate through the CoM Explore v2.1 API and return all records."""
    url = f"{API_BASE}/{config['dataset_id']}/records"
    all_records: list[dict] = []
    offset = 0

    while offset < MAX_API_OFFSET:
        resp = requests.get(url, params={"limit": PAGE_SIZE, "offset": offset}, timeout=60)
        resp.raise_for_status()
        records = resp.json().get("results", [])
        all_records.extend(records)

        if len(records) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        if offset % 1000 == 0:
            log.info("  %s: %d records so far …", name, len(all_records))

    return all_records


def main():
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    fetched_at = datetime.now(timezone.utc)
    log.info("Fetching bronze data at %s", fetched_at.isoformat())
    log.info("Output directory: %s\n", BASE_DIR)

    meta: dict = {
        "pipeline_stage": "bronze",
        "fetched_at": fetched_at.isoformat(),
        "api_base": API_BASE,
        "api_licence": "CC BY - City of Melbourne Open Data",
        "api_portal": "https://data.melbourne.vic.gov.au",
        "datasets": {},
        "notes": [
            "Bronze data is raw - no transformations applied.",
            "Sensors use kerbsideid, restrictions use bayid + deviceid.",
            "deviceid (restrictions) = kerbsideid (sensors) — the correct join key.",
            "Restrictions dataset has NO street name column.",
        ],
    }

    for name, config in DATASETS.items():
        try:
            log.info("Fetching %s (%s) …", name, config["description"])
            records = fetch_dataset(name, config)

            df = pd.DataFrame(records)
            out_path = BASE_DIR / config["output_file"]
            df.to_parquet(out_path, index=False, engine="pyarrow")

            log.info("  Saved %d records → %s", len(df), out_path.name)

            meta["datasets"][name] = {
                "dataset_id": config["dataset_id"],
                "description": config["description"],
                "output_file": str(out_path),
                "rows": len(df),
                "columns": list(df.columns),
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            }
        except Exception as e:
            log.error("  ERROR fetching %s: %s", name, e)

    meta_path = BASE_DIR / "fetch_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)

    log.info("\nBronze fetch complete. Metadata → %s", meta_path.name)


if __name__ == "__main__":
    main()
