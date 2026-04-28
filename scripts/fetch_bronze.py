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

import argparse
import json
import io
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
EXPORT_BASE = "https://data.melbourne.vic.gov.au/api/v2/catalog/datasets"

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
        "use_csv_export": True,
    },
    "zones_to_segments": {
        "dataset_id": "parking-zones-linked-to-street-segments",
        "description": "Parking zone to street segment mapping",
        "output_file": "zones_to_segments.parquet",
    },
    "sign_plates": {
        "dataset_id": "sign-plates-located-in-each-parking-zone",
        "description": "Sign plate restrictions per parking zone",
        "output_file": "sign_plates.parquet",
    },
    "addresses": {
        "dataset_id": "street-addresses",
        "description": "City of Melbourne street/property addresses for search",
        "output_file": "addresses.parquet",
    },
    "disability_parking_arcgis": {
        "dataset_id": "arcgis_accessibility_map_layers_disabled_parking",
        "description": "Disabled parking points (ArcGIS FeatureServer export as GeoJSON)",
        "output_file": "disability_parking_arcgis.parquet",
        "geojson_url": (
            "https://services1.arcgis.com/KGdHCCUjGBpOPPac/arcgis/rest/services/"
            "Accessibility_map_layers/FeatureServer/disabled_parking/query"
        ),
    },
}

MAX_API_OFFSET = 10_000
PAGE_SIZE = 100


def _sanitize_bronze_df(df: pd.DataFrame) -> pd.DataFrame:
    """Stringify dict/list cells so PyArrow can write API records with varying nested shapes."""
    out = df.copy()
    for col in out.columns:
        if out[col].dtype != object:
            continue
        sample = out[col].dropna()
        if sample.empty:
            continue
        if isinstance(sample.iloc[0], (dict, list)):
            out[col] = out[col].apply(
                lambda x: json.dumps(x, sort_keys=True) if isinstance(x, (dict, list)) else x
            )
    return out


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


def fetch_csv_export(dataset_id: str) -> list[dict]:
    """Download full dataset via CSV export endpoint (bypasses 10k offset cap)."""
    url = f"{EXPORT_BASE}/{dataset_id}/exports/csv"
    resp = requests.get(url, params={"delimiter": ","}, timeout=120)
    resp.raise_for_status()
    df = pd.read_csv(io.StringIO(resp.text))
    log.info("  CSV export: %d rows, %d columns", len(df), len(df.columns))
    return df.to_dict(orient="records")


def fetch_geojson_export(url: str) -> list[dict]:
    """Fetch a GeoJSON FeatureCollection and flatten to tabular records."""
    resp = requests.get(url, params={"where": "1=1", "f": "geojson"}, timeout=120)
    resp.raise_for_status()
    data = resp.json()
    feats = data.get("features") or []
    rows: list[dict] = []
    for f in feats:
        props = f.get("properties") or {}
        geom = f.get("geometry") or {}
        coords = geom.get("coordinates") or [None, None]
        lon = coords[0] if isinstance(coords, list) and len(coords) >= 2 else None
        lat = coords[1] if isinstance(coords, list) and len(coords) >= 2 else None
        rows.append({**props, "lat": lat, "lon": lon, "geometry_type": geom.get("type")})
    return rows


def main(selected_datasets: list[str] | None = None):
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
            "deviceid (restrictions) = kerbsideid (sensors) — direct join key.",
            "Coverage is improved through segment chain: bays -> zones_to_segments -> sign_plates.",
            "Restrictions dataset has NO street name column.",
            "Large datasets may require CSV export to bypass API offset limits.",
        ],
    }

    dataset_items = DATASETS.items()
    if selected_datasets:
        dataset_items = [(name, DATASETS[name]) for name in selected_datasets]

    for name, config in dataset_items:
        try:
            log.info("Fetching %s (%s) …", name, config["description"])
            if config.get("geojson_url"):
                records = fetch_geojson_export(config["geojson_url"])
            elif config.get("use_csv_export"):
                records = fetch_csv_export(config["dataset_id"])
            else:
                records = fetch_dataset(name, config)

            df = _sanitize_bronze_df(pd.DataFrame(records))
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
    parser = argparse.ArgumentParser(
        description="Fetch MeloPark bronze datasets from CoM Open Data API."
    )
    parser.add_argument(
        "--datasets",
        nargs="+",
        choices=list(DATASETS.keys()),
        help="Optional subset of datasets to fetch.",
    )
    args = parser.parse_args()
    main(selected_datasets=args.datasets)
