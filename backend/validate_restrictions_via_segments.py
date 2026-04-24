"""
validate_restrictions_via_segments.py
=====================================
Tests whether the existing restrictions dataset (with full time windows)
can be propagated to sensor bays through the street-segment chain.

The idea: restrictions already have deviceid (= kerbsideid). If those
deviceid values appear in parking_bays, they have a roadsegmentid.
Any sensor bay on the same roadsegmentid gets those same restriction
rules — with full fromday/today/starttime/endtime/duration_mins.

This keeps the restriction translator working exactly as-is, just
with much broader coverage.

Chain:
  restrictions.deviceid → parking_bays.kerbsideid → roadsegmentid
  sensors.kerbsideid → parking_bays.kerbsideid → roadsegmentid
  Same roadsegmentid = same street = same rules

Run from repo root:
    python scripts/validate_restrictions_via_segments.py

Requires: requests, pandas, pyarrow
"""

import json
import logging
import sys
from pathlib import Path

import pandas as pd
import requests

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("validate_rest_seg")

ROOT = Path(__file__).resolve().parent.parent
BRONZE_DIR = ROOT / "data" / "bronze"
SILVER_DIR = ROOT / "data" / "silver"

API_BASE = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
PAGE_SIZE = 100
MAX_OFFSET = 10_000


def fetch_all(dataset_id: str) -> pd.DataFrame:
    url = f"{API_BASE}/{dataset_id}/records"
    records = []
    offset = 0
    while offset < MAX_OFFSET:
        resp = requests.get(url, params={"limit": PAGE_SIZE, "offset": offset}, timeout=60)
        resp.raise_for_status()
        batch = resp.json().get("results", [])
        records.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    df = pd.DataFrame(records)
    log.info("  Fetched %s: %d records", dataset_id, len(records))
    return df


def norm(series: pd.Series) -> pd.Series:
    s = series.astype(str).str.strip().str.lower()
    numeric = s.str.match(r"^\d+$")
    s[numeric] = s[numeric].apply(lambda x: str(int(x)))
    return s


def main():
    print("=" * 70)
    print("MeloPark — Can restrictions propagate via street segments?")
    print("=" * 70)

    # ── Load existing data ───────────────────────────────────────────────

    print("\n--- Loading existing data ---")

    sensors = pd.read_parquet(SILVER_DIR / "sensors_clean.parquet")
    sensors["bay_id"] = norm(sensors["bay_id"])
    sensor_ids = set(sensors["bay_id"].unique())
    print(f"  Sensors: {len(sensor_ids):,} bays")

    restrictions = pd.read_parquet(SILVER_DIR / "restrictions_long.parquet")
    restrictions["bay_id"] = norm(restrictions["bay_id"])
    restriction_ids = set(restrictions["bay_id"].unique())
    print(f"  Restrictions: {len(restrictions):,} rows across {len(restriction_ids):,} bays")

    # Load full parking_bays from CSV
    pbays_csv = ROOT / "data" / "on-street-parking-bays.csv"
    if not pbays_csv.exists():
        print(f"  ERROR: {pbays_csv} not found")
        sys.exit(1)
    pbays = pd.read_csv(pbays_csv, sep=None, engine="python")
    if len(pbays.columns) <= 2:
        pbays = pd.read_csv(pbays_csv, sep=";")
    print(f"  Parking bays: {len(pbays):,} rows")
    print(f"  Parking bays columns: {list(pbays.columns)}")

    # Find key columns
    kerb_col = next((c for c in pbays.columns if "kerbside" in c.lower()), None)
    seg_col = next((c for c in pbays.columns
                    if "roadsegment" in c.lower() and "id" in c.lower()
                    and "desc" not in c.lower()), None)
    seg_desc_col = next((c for c in pbays.columns
                         if "roadsegment" in c.lower() and "desc" in c.lower()), None)

    if not kerb_col or not seg_col:
        print(f"  ERROR: Missing columns. kerb={kerb_col}, seg={seg_col}")
        sys.exit(1)

    pbays["_kerb"] = norm(pbays[kerb_col])
    pbays["_seg"] = pbays[seg_col].astype(str).str.strip()

    # ── Step 1: How many restriction bays are in parking_bays? ───────────

    print("\n--- Step 1: Restrictions → parking_bays overlap ---")

    pbay_kerb_ids = set(pbays["_kerb"].unique())
    rest_in_pbays = restriction_ids & pbay_kerb_ids
    rest_not_in_pbays = restriction_ids - pbay_kerb_ids

    print(f"  Restriction bays:              {len(restriction_ids):,}")
    print(f"  Found in parking_bays:         {len(rest_in_pbays):,}  "
          f"({100 * len(rest_in_pbays) / len(restriction_ids):.1f}%)")
    print(f"  Not found:                     {len(rest_not_in_pbays):,}")

    # What road segments do restriction bays sit on?
    rest_pbays = pbays[pbays["_kerb"].isin(rest_in_pbays)].copy()
    rest_segments = set(rest_pbays["_seg"].dropna().unique())
    print(f"  Road segments with restrictions: {len(rest_segments):,}")

    if seg_desc_col:
        sample_streets = rest_pbays[[seg_col, seg_desc_col]].drop_duplicates().head(10)
        print(f"\n  Sample streets with restriction data:")
        for _, row in sample_streets.iterrows():
            print(f"    Segment {row[seg_col]}: {row[seg_desc_col]}")

    # ── Step 2: How many sensor bays are on those same segments? ─────────

    print("\n--- Step 2: Sensors on restriction-covered segments ---")

    sensor_pbays = pbays[pbays["_kerb"].isin(sensor_ids)].copy()
    sensor_with_seg = sensor_pbays[sensor_pbays["_seg"].notna()].copy()
    sensor_segments = set(sensor_with_seg["_seg"].unique())

    print(f"  Sensor bays in parking_bays:   {len(sensor_pbays['_kerb'].unique()):,}")
    print(f"  Sensor bays with segment ID:   {len(sensor_with_seg['_kerb'].unique()):,}")
    print(f"  Unique sensor segments:        {len(sensor_segments):,}")

    # Overlap: sensor segments that also have restriction data
    covered_segments = sensor_segments & rest_segments
    uncovered_segments = sensor_segments - rest_segments

    print(f"\n  Sensor segments with restrictions:  {len(covered_segments):,}  "
          f"({100 * len(covered_segments) / max(len(sensor_segments), 1):.1f}%)")
    print(f"  Sensor segments without:            {len(uncovered_segments):,}")

    # How many sensor BAYS does that cover?
    covered_sensor_bays = sensor_with_seg[
        sensor_with_seg["_seg"].isin(covered_segments)
    ]["_kerb"].unique()
    uncovered_sensor_bays = sensor_with_seg[
        sensor_with_seg["_seg"].isin(uncovered_segments)
    ]["_kerb"].unique()

    print(f"\n  Sensor bays covered by restriction segments: "
          f"{len(covered_sensor_bays):,} / {len(sensor_ids):,}  "
          f"({100 * len(covered_sensor_bays) / len(sensor_ids):.1f}%)")
    print(f"  Sensor bays NOT covered:                     "
          f"{len(uncovered_sensor_bays):,}")

    # ── Step 3: What restrictions would propagate? ───────────────────────

    print("\n--- Step 3: Restriction propagation detail ---")

    # For each covered segment, how many restriction rows exist?
    rest_on_covered = restrictions[
        restrictions["bay_id"].isin(
            rest_pbays[rest_pbays["_seg"].isin(covered_segments)]["_kerb"]
        )
    ]

    print(f"  Restriction rows on covered segments: {len(rest_on_covered):,}")
    print(f"  Unique typedesc values: {rest_on_covered['typedesc'].nunique():,}")

    if "typedesc" in rest_on_covered.columns:
        print(f"\n  Top restriction types that would propagate:")
        top = rest_on_covered["typedesc"].value_counts().head(15)
        for td, count in top.items():
            print(f"    {td}: {count} rows")

    # ── Step 4: Check what the uncovered segments have ───────────────────

    print("\n--- Step 4: Analysing uncovered sensor segments ---")

    # These segments have sensors but no restriction-dataset bays
    # Could sign plates help here?
    if len(uncovered_segments) > 0 and seg_desc_col:
        uncovered_streets = sensor_with_seg[
            sensor_with_seg["_seg"].isin(uncovered_segments)
        ][[seg_col, seg_desc_col]].drop_duplicates()
        print(f"  Uncovered segments ({len(uncovered_segments)}):")
        for _, row in uncovered_streets.head(15).iterrows():
            bays_on_seg = len(sensor_with_seg[sensor_with_seg["_seg"] == row[seg_col]])
            print(f"    {row[seg_desc_col]} (segment {row[seg_col]}): {bays_on_seg} sensor bays")

    # ── Step 5: What about sign plates for the gap? ──────────────────────

    print("\n--- Step 5: Can sign plates fill the gap? ---")

    zones_to_segs = fetch_all("parking-zones-linked-to-street-segments")
    sign_plates = fetch_all("sign-plates-located-in-each-parking-zone")

    z_seg_col = next((c for c in zones_to_segs.columns
                      if "segment" in c.lower() and "id" in c.lower()), None)
    z_zone_col = next((c for c in zones_to_segs.columns
                       if "zone" in c.lower() or "parking" in c.lower()), None)
    sp_zone_col = next((c for c in sign_plates.columns
                        if "zone" in c.lower() or "parking" in c.lower()), None)

    if z_seg_col and z_zone_col and sp_zone_col:
        zones_to_segs[z_seg_col] = zones_to_segs[z_seg_col].astype(str).str.strip()
        zones_to_segs[z_zone_col] = zones_to_segs[z_zone_col].astype(str).str.strip()
        sign_plates[sp_zone_col] = sign_plates[sp_zone_col].astype(str).str.strip()

        # Check uncovered segments against zones
        zone_seg_ids = set(zones_to_segs[z_seg_col].unique())
        uncovered_in_zones = uncovered_segments & zone_seg_ids

        if uncovered_in_zones:
            uncovered_zones = zones_to_segs[
                zones_to_segs[z_seg_col].isin(uncovered_in_zones)
            ][z_zone_col].unique()
            sp_zones = set(sign_plates[sp_zone_col].unique())
            uncovered_with_signs = set(uncovered_zones) & sp_zones

            extra_bays = sensor_with_seg[
                sensor_with_seg["_seg"].isin(uncovered_in_zones)
            ]["_kerb"].nunique()

            print(f"  Uncovered segments found in zones dataset: {len(uncovered_in_zones):,}")
            print(f"  Of those, zones with sign plates:          {len(uncovered_with_signs):,}")
            print(f"  Extra sensor bays recoverable:             {extra_bays:,}")

            # Show sign plate columns for reference
            print(f"\n  Sign plates columns: {list(sign_plates.columns)}")
            sp_sample = sign_plates[sign_plates[sp_zone_col].isin(uncovered_with_signs)].head(5)
            if len(sp_sample) > 0:
                print(f"  Sample sign plate rows from uncovered zones:")
                for _, row in sp_sample.iterrows():
                    print(f"    {dict(row)}")
        else:
            extra_bays = 0
            print(f"  No uncovered segments found in zones dataset.")
    else:
        extra_bays = 0
        print(f"  Could not check — missing columns in zones/sign_plates.")

    # ── Summary ──────────────────────────────────────────────────────────

    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    total = len(sensor_ids)
    old = len(sensor_ids & restriction_ids)
    new_via_segments = len(covered_sensor_bays)
    new_via_signs = extra_bays if extra_bays else 0
    combined = new_via_segments + new_via_signs
    still_missing = total - combined - (total - len(sensor_pbays["_kerb"].unique()))

    print(f"\n  Total sensor bays:                    {total:,}")
    print(f"  OLD (direct deviceid join):           {old:,}  ({100*old/total:.1f}%)")
    print(f"  NEW via restrictions + segments:       {new_via_segments:,}  ({100*new_via_segments/total:.1f}%)")
    print(f"  Extra via sign plates (gap fill):     {new_via_signs:,}")
    print(f"  COMBINED:                             {combined:,}  ({100*combined/total:.1f}%)")
    print(f"  Still uncovered:                      {total - combined:,}")

    print(f"\n  Data quality:")
    print(f"    Restrictions-via-segments:  Full time windows (fromday/today/starttime/endtime/duration)")
    print(f"    Sign plates (gap fill):    Display codes only — need parsing or all-day defaults")

    # ── Save ─────────────────────────────────────────────────────────────

    output = {
        "total_sensor_bays": total,
        "old_direct_join": old,
        "restriction_bays_in_pbays": len(rest_in_pbays),
        "road_segments_with_restrictions": len(rest_segments),
        "sensor_segments_total": len(sensor_segments),
        "sensor_segments_covered": len(covered_segments),
        "sensor_segments_uncovered": len(uncovered_segments),
        "sensor_bays_via_restriction_segments": len(covered_sensor_bays),
        "sensor_bays_via_sign_plates_gap": new_via_signs,
        "combined_coverage": combined,
        "combined_coverage_pct": round(100 * combined / total, 1),
        "restriction_rows_propagated": len(rest_on_covered),
    }

    out_path = ROOT / "data" / "restriction_segment_validation.json"
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n  Saved to {out_path}")


if __name__ == "__main__":
    main()
