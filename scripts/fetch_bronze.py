"""
fetch_bronze.py - Downloads raw data from City of Melbourne APIs
and saves to data/bronze/ without any transformation.

Usage:
    python scripts/fetch_bronze.py

This pulls:
    1. Live sensor data (snapshot)
    2. Parking bays (static, full export)
    3. Bay restrictions (static, full export)
    4. Meters with location (static, full export)
"""

import os
import json
import requests
from datetime import datetime

BASE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'bronze')

DATASETS = {
    'sensors': {
        'url': 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/on-street-parking-bay-sensors/records',
        'params': {'limit': 5000},
    },
    'bays': {
        'url': 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/on-street-parking-bays/records',
        'params': {'limit': 5000},
    },
    'restrictions': {
        'url': 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/on-street-car-park-bay-restrictions/records',
        'params': {'limit': 5000},
    },
    'meters': {
        'url': 'https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/on-street-car-parking-meters-with-location/records',
        'params': {'limit': 5000},
    },
}


def fetch_dataset(name, config):
    print(f"  Fetching {name}...")
    all_records = []
    offset = 0
    limit = config['params'].get('limit', 5000)

    while True:
        params = {**config['params'], 'offset': offset}
        resp = requests.get(config['url'], params=params, timeout=60)
        resp.raise_for_status()
        data = resp.json()

        records = data.get('results', [])
        all_records.extend(records)

        if len(records) < limit:
            break

        offset += limit
        print(f"    ... fetched {len(all_records)} records so far")

    return all_records


def main():
    os.makedirs(BASE_DIR, exist_ok=True)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    print(f"Fetching bronze data at {timestamp}")
    print(f"Output directory: {os.path.abspath(BASE_DIR)}\n")

    for name, config in DATASETS.items():
        try:
            records = fetch_dataset(name, config)

            # Save with timestamp for sensors (snapshot), without for static
            if name == 'sensors':
                filename = f'{name}_{timestamp}.json'
            else:
                filename = f'{name}.json'

            filepath = os.path.join(BASE_DIR, filename)
            with open(filepath, 'w') as f:
                json.dump(records, f)

            print(f"  Saved {len(records)} records to {filename}")

        except Exception as e:
            print(f"  ERROR fetching {name}: {e}")

    print("\nBronze fetch complete.")


if __name__ == '__main__':
    main()
