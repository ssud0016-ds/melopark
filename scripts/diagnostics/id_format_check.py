"""Quick diagnostic: compare bay_id formats between sensor-only and restriction bays."""

import os
import sys
from pathlib import Path

import pandas as pd
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

df = pd.read_sql(text("SELECT bay_id, has_restriction_data FROM bays"), engine)

sensor_only = df[~df["has_restriction_data"]]["bay_id"]
restriction = df[df["has_restriction_data"]]["bay_id"]

print(f"=== Sensor-only bays ({len(sensor_only)} total) ===")
print(f"  Sample IDs: {sensor_only.head(15).tolist()}")
print(f"  ID lengths:  {sensor_only.str.len().value_counts().sort_index().to_dict()}")
print(f"  Numeric?     {sensor_only.str.isnumeric().sum()} / {len(sensor_only)}")
print()
print(f"=== Restriction bays ({len(restriction)} total) ===")
print(f"  Sample IDs: {restriction.head(15).tolist()}")
print(f"  ID lengths:  {restriction.str.len().value_counts().sort_index().to_dict()}")
print(f"  Numeric?     {restriction.str.isnumeric().sum()} / {len(restriction)}")

overlap = set(sensor_only) & set(restriction)
print(f"\n=== Overlap: {len(overlap)} bay_ids appear in BOTH groups ===")
if overlap:
    print(f"  Sample: {list(overlap)[:10]}")

print("\n=== Looking for near-miss patterns ===")
sensor_set = set(sensor_only)
restrict_set = set(restriction)

stripped_sensor = {s.lstrip("0"): s for s in sensor_set}
stripped_restrict = {s.lstrip("0"): s for s in restrict_set}
strip_overlap = set(stripped_sensor) & set(stripped_restrict)
if strip_overlap:
    print(f"  Leading-zero matches: {len(strip_overlap)}")
    for k in list(strip_overlap)[:5]:
        print(f"    sensor '{stripped_sensor[k]}' <-> restriction '{stripped_restrict[k]}'")

sensor_nums = {int(s): s for s in sensor_set if s.isnumeric()}
restrict_nums = {int(s): s for s in restrict_set if s.isnumeric()}
num_overlap = set(sensor_nums) & set(restrict_nums)
if num_overlap:
    print(f"  Numeric-value matches: {len(num_overlap)}")
    for k in list(num_overlap)[:5]:
        print(f"    sensor '{sensor_nums[k]}' <-> restriction '{restrict_nums[k]}'")
