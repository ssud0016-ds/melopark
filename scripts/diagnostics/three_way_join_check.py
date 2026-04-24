"""
Check if parking_bays.kerbsideid can serve as the hub to join
sensors (kerbsideid) and restrictions (deviceid) together.
"""

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

# ── 1. Fetch parking_bays (static bay geometry) ─────────────────────────
print("Fetching parking_bays from CoM API...")
api_url = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/on-street-parking-bays/records"
all_bays = []
offset = 0
while True:
    resp = requests.get(api_url, params={"limit": 100, "offset": offset}, timeout=60)
    resp.raise_for_status()
    records = resp.json().get("results", [])
    all_bays.extend(records)
    if len(records) < 100 or offset + 100 >= 10000:
        break
    offset += 100
    if offset % 1000 == 0:
        print(f"  ... {len(all_bays)} records")

pbays = pd.DataFrame(all_bays)
pbays["kerbsideid"] = pbays["kerbsideid"].astype(str).str.strip()
pbays = pbays[pbays["kerbsideid"].notna() & (pbays["kerbsideid"] != "") & (pbays["kerbsideid"] != "None")]
pbays_ids = set(pbays["kerbsideid"].unique())
print(f"Parking bays: {len(all_bays)} total, {len(pbays_ids)} with kerbsideid")

# ── 2. Fetch restrictions (with deviceid) ───────────────────────────────
print("\nFetching restrictions from CoM API...")
api_url2 = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets/on-street-car-park-bay-restrictions/records"
all_rest = []
offset = 0
while True:
    resp = requests.get(api_url2, params={"limit": 100, "offset": offset}, timeout=60)
    resp.raise_for_status()
    records = resp.json().get("results", [])
    all_rest.extend(records)
    if len(records) < 100 or offset + 100 >= 10000:
        break
    offset += 100
    if offset % 1000 == 0:
        print(f"  ... {len(all_rest)} records")

rdf = pd.DataFrame(all_rest)
rdf["deviceid"] = rdf["deviceid"].astype(str).str.strip()
rdf["bayid"] = rdf["bayid"].astype(str).str.strip()
rest_deviceids = set(rdf["deviceid"].unique())
rest_bayids = set(rdf["bayid"].unique())
print(f"Restrictions: {len(all_rest)} records, {len(rest_deviceids)} unique deviceids, {len(rest_bayids)} unique bayids")

# ── 3. Get sensor kerbsideids from DB ───────────────────────────────────
sensor_df = pd.read_sql(text("SELECT bay_id FROM bays"), engine)
sensor_ids = set(sensor_df["bay_id"].unique())
print(f"\nSensor bay_ids (kerbsideid) in DB: {len(sensor_ids)}")

# ── 4. Check overlaps ───────────────────────────────────────────────────
print("\n" + "=" * 60)
print("THREE-WAY JOIN ANALYSIS")
print("=" * 60)

# Sensors ∩ Parking Bays (both use kerbsideid)
s_pb = sensor_ids & pbays_ids
print(f"\nSensors ∩ Parking Bays (kerbsideid):  {len(s_pb)} / {len(sensor_ids)} sensors ({100*len(s_pb)/max(len(sensor_ids),1):.1f}%)")

# Restrictions.deviceid ∩ Parking Bays.kerbsideid
r_pb = rest_deviceids & pbays_ids
print(f"Restrictions ∩ Parking Bays (deviceid=kerbsideid):  {len(r_pb)} / {len(rest_deviceids)} restrictions ({100*len(r_pb)/max(len(rest_deviceids),1):.1f}%)")

# Sensors ∩ Restrictions (via deviceid = kerbsideid)
s_r = sensor_ids & rest_deviceids
print(f"Sensors ∩ Restrictions (kerbsideid=deviceid):  {len(s_r)} / {len(sensor_ids)} sensors ({100*len(s_r)/max(len(sensor_ids),1):.1f}%)")

# All three
all_three = sensor_ids & pbays_ids & rest_deviceids
print(f"\nALL THREE (sensor + geometry + restriction):  {len(all_three)} bays")

# Sensor + restriction (no parking_bays needed since sensors have lat/lon)
print(f"Sensor + Restriction (live status + rules):   {len(s_r)} bays")

# Restriction with geometry (via parking_bays)
print(f"Restriction + Geometry (rules + location):    {len(r_pb)} bays")

# What we could show on the map:
print(f"\n--- MAP COVERAGE ---")
print(f"Bays with live sensor status:              {len(sensor_ids)}")
print(f"Bays with restriction rules + geometry:    {len(r_pb)}")
print(f"Bays with BOTH (full features):            {len(s_r)}")
print(f"Sensor bays without any restriction data:  {len(sensor_ids - rest_deviceids)}")
print(f"Restriction bays without any sensor:       {len(rest_deviceids - sensor_ids)}")

# Sample the full-feature bays
if all_three:
    print(f"\nSample full-feature bays (kerbsideid → bayid):")
    for kid in list(all_three)[:8]:
        bayid = rdf[rdf["deviceid"] == kid]["bayid"].iloc[0]
        desc = rdf[rdf["deviceid"] == kid]["description1"].iloc[0]
        print(f"  kerbsideid={kid} → bayid={bayid}  restriction: {desc}")
