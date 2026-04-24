"""Fetch a sample from the parking_bays API to check available columns and find the bridge key."""

import requests

url = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/on-street-parking-bays/records"
resp = requests.get(url, params={"limit": 5}, timeout=30)
resp.raise_for_status()
records = resp.json().get("results", [])

print(f"Fetched {len(records)} sample records\n")
print(f"Columns: {list(records[0].keys())}\n")

for r in records[:3]:
    print({k: r.get(k) for k in ["bay_id", "bayid", "kerbsideid", "marker_id", "rd_seg_id",
                                   "rd_seg_dsc", "the_geom", "last_edit", "latitude", "longitude"]
           if r.get(k) is not None})
    print()
