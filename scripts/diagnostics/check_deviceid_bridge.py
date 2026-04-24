"""Check if restrictions.deviceid matches sensors.kerbsideid — the potential bridge key."""

import os
import sys
from pathlib import Path

import pandas as pd
import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = ROOT / "backend"

load_dotenv(BACKEND_DIR / ".env")
url = os.environ.get("DATABASE_URL")
if not url:
    print("DATABASE_URL not set"); sys.exit(1)

from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
parsed = urlparse(url)
if parsed.query:
    pairs = []
    for k, v in parse_qsl(parsed.query, keep_blank_values=True):
        if k == "sslrootcert" and v and not Path(v).is_absolute():
            v = (BACKEND_DIR / v.lstrip("./\\")).resolve().as_posix()
        pairs.append((k, v))
    url = urlunparse((parsed.scheme, parsed.netloc, parsed.path, parsed.params, urlencode(pairs), parsed.fragment))

engine = create_engine(url, pool_pre_ping=True)

# Get sensor kerbsideids from DB (these are our bay_ids for sensor-only bays)
sensor_ids = set(
    pd.read_sql(text("SELECT bay_id FROM bays WHERE has_restriction_data = false"), engine)["bay_id"]
)
print(f"Sensor-only bay_ids (kerbsideid) in DB: {len(sensor_ids)}")
print(f"  Samples: {list(sensor_ids)[:10]}")

# Fetch ALL restriction records from API to get deviceid
print("\nFetching restrictions from API (all records)...")
api_url = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/on-street-car-park-bay-restrictions/records"
all_records = []
offset = 0
while True:
    resp = requests.get(api_url, params={"limit": 100, "offset": offset}, timeout=60)
    resp.raise_for_status()
    records = resp.json().get("results", [])
    all_records.extend(records)
    if len(records) < 100:
        break
    offset += 100

print(f"Fetched {len(all_records)} restriction records")

# Extract bayid -> deviceid mapping
bayid_to_deviceid = {}
deviceid_to_bayid = {}
for r in all_records:
    bayid = str(r.get("bayid", "")).strip()
    deviceid = str(r.get("deviceid", "")).strip()
    if bayid and deviceid and deviceid != "None" and deviceid != "":
        bayid_to_deviceid[bayid] = deviceid
        deviceid_to_bayid[deviceid] = bayid

print(f"\nRestriction records with deviceid: {len(bayid_to_deviceid)}")
print(f"Unique deviceids: {len(set(bayid_to_deviceid.values()))}")
print(f"  Sample bayid -> deviceid:")
for bayid, devid in list(bayid_to_deviceid.items())[:5]:
    print(f"    bayid={bayid}  ->  deviceid={devid}")

# Check overlap between deviceid and sensor kerbsideid
device_ids = set(bayid_to_deviceid.values())
overlap = sensor_ids & device_ids
print(f"\n=== OVERLAP: deviceid ∩ sensor kerbsideid ===")
print(f"  Sensor kerbsideids:    {len(sensor_ids)}")
print(f"  Restriction deviceids: {len(device_ids)}")
print(f"  MATCHED:               {len(overlap)} ({100*len(overlap)/max(len(sensor_ids),1):.1f}% of sensors)")

if overlap:
    print(f"\n  Sample matches:")
    for devid in list(overlap)[:10]:
        bayid = deviceid_to_bayid[devid]
        print(f"    kerbsideid={devid} <-> bayid={bayid}")

# Also check restriction bay_ids already in the DB
restrict_db = set(
    pd.read_sql(text("SELECT bay_id FROM bays WHERE has_restriction_data = true"), engine)["bay_id"]
)
print(f"\nRestriction bay_ids already in DB: {len(restrict_db)}")
print(f"  These are bayid values: {list(restrict_db)[:10]}")

# How many of the matched deviceids would be NEW enrichments?
already_has_data = set()
for devid in overlap:
    bayid = deviceid_to_bayid[devid]
    if bayid in restrict_db:
        already_has_data.add(devid)

print(f"\nOf the {len(overlap)} matched sensors:")
print(f"  Already have restriction data via bayid:  {len(already_has_data)}")
print(f"  NEW enrichments possible via deviceid:    {len(overlap) - len(already_has_data)}")
