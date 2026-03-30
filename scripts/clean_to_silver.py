"""
clean_to_silver.py - Transforms bronze data into cleaned silver CSVs.

Usage:
    python scripts/clean_to_silver.py

Reads from data/bronze/, writes to data/silver/.
This script is idempotent - safe to re-run whenever bronze data updates.
"""

import os
import json
import pandas as pd
from datetime import datetime

BRONZE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'bronze')
SILVER_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'silver')

# Melbourne bounding box for coordinate validation
MELB_LAT_MIN, MELB_LAT_MAX = -37.85, -37.78
MELB_LON_MIN, MELB_LON_MAX = 144.92, 144.99


def load_bronze(filename):
    filepath = os.path.join(BRONZE_DIR, filename)
    if not os.path.exists(filepath):
        print(f"  WARNING: {filename} not found in bronze. Run fetch_bronze.py first.")
        return None
    with open(filepath) as f:
        return json.load(f)


def clean_bays():
    """Clean parking bays data."""
    print("Cleaning parking bays...")
    records = load_bronze('bays.json')
    if records is None:
        return

    df = pd.json_normalize(records)

    # Standardise column names
    df.columns = [c.lower().replace('.', '_') for c in df.columns]

    initial = len(df)

    # Drop bays without a marker_id (can't join to sensors)
    df = df.dropna(subset=['marker_id'])

    # Validate coordinates if present
    if 'geo_point_2d_lat' in df.columns:
        coord_mask = (
            df['geo_point_2d_lat'].between(MELB_LAT_MIN, MELB_LAT_MAX) &
            df['geo_point_2d_lon'].between(MELB_LON_MIN, MELB_LON_MAX)
        )
        dropped = (~coord_mask).sum()
        if dropped > 0:
            print(f"  Dropped {dropped} bays with coordinates outside Melbourne")
        df = df[coord_mask]

    print(f"  {initial} -> {len(df)} records ({initial - len(df)} removed)")

    outpath = os.path.join(SILVER_DIR, 'bays.csv')
    df.to_csv(outpath, index=False)
    print(f"  Saved to {outpath}")


def clean_restrictions():
    """
    Clean and normalise restrictions from wide to long format.
    Each bay's multiple restriction windows become separate rows.
    """
    print("Cleaning restrictions...")
    records = load_bronze('restrictions.json')
    if records is None:
        return

    normalised_rows = []

    for record in records:
        bay_id = record.get('bayid')
        device_id = record.get('deviceid')
        description = record.get('description', '')

        # Parse each numbered restriction window
        for i in range(1, 10):
            type_key = f'typedesc{i}'
            from_day_key = f'fromday{i}'

            type_desc = record.get(type_key)
            from_day = record.get(from_day_key)

            # Stop when we hit an empty window
            if type_desc is None or from_day is None:
                break

            # Skip OLD restrictions
            if str(type_desc).upper().endswith('OLD'):
                continue

            normalised_rows.append({
                'bay_id': bay_id,
                'device_id': device_id,
                'description': description,
                'window_number': i,
                'from_day': _safe_int(from_day),
                'to_day': _safe_int(record.get(f'today{i}')),
                'start_time': record.get(f'starttime{i}', ''),
                'end_time': record.get(f'endtime{i}', ''),
                'type_desc': str(type_desc),
                'duration_min': _safe_int(record.get(f'duration{i}')),
                'disability_ext_min': _safe_int(record.get(f'disabilityext{i}')),
                'effective_on_ph': record.get(f'effectiveonph{i}'),
                'exemption': record.get(f'exemption{i}', ''),
            })

    df = pd.DataFrame(normalised_rows)
    initial_bays = df['bay_id'].nunique()

    # Drop rows where essential fields are missing
    df = df.dropna(subset=['bay_id', 'from_day', 'to_day', 'type_desc'])

    print(f"  {len(normalised_rows)} restriction windows across {initial_bays} bays")
    print(f"  After cleaning: {len(df)} windows")

    outpath = os.path.join(SILVER_DIR, 'restrictions_normalised.csv')
    df.to_csv(outpath, index=False)
    print(f"  Saved to {outpath}")


def clean_meters():
    """Clean meters with location data."""
    print("Cleaning meters...")
    records = load_bronze('meters.json')
    if records is None:
        return

    df = pd.json_normalize(records)
    df.columns = [c.lower().replace('.', '_') for c in df.columns]

    initial = len(df)

    # Validate coordinates
    if 'geo_point_2d_lat' in df.columns:
        coord_mask = (
            df['geo_point_2d_lat'].between(MELB_LAT_MIN, MELB_LAT_MAX) &
            df['geo_point_2d_lon'].between(MELB_LON_MIN, MELB_LON_MAX)
        )
        df = df[coord_mask]

    print(f"  {initial} -> {len(df)} records")

    outpath = os.path.join(SILVER_DIR, 'meters.csv')
    df.to_csv(outpath, index=False)
    print(f"  Saved to {outpath}")


def _safe_int(val):
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None


def main():
    os.makedirs(SILVER_DIR, exist_ok=True)

    print(f"Bronze directory: {os.path.abspath(BRONZE_DIR)}")
    print(f"Silver directory: {os.path.abspath(SILVER_DIR)}\n")

    clean_bays()
    print()
    clean_restrictions()
    print()
    clean_meters()

    print("\nSilver cleaning complete.")


if __name__ == '__main__':
    main()
