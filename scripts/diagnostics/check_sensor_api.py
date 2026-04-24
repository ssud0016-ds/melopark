"""Fetch a sample from the sensors API to check all available columns."""

import requests

url = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/on-street-parking-bay-sensors/records"
resp = requests.get(url, params={"limit": 5}, timeout=30)
resp.raise_for_status()
records = resp.json().get("results", [])

print(f"Fetched {len(records)} sample records\n")
print(f"All columns ({len(records[0].keys())}):")
for k in sorted(records[0].keys()):
    print(f"  {k}: {records[0][k]}")
