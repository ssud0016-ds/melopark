"""
validate_segment_join.py
========================
Tests whether street-segment-level restriction propagation can solve
MeloPark's coverage gap.

The hypothesis: instead of joining sensors → restrictions at the bay level
(which only covers ~72 bays), we join through street segments:

  sensor (kerbsideid)
    → parking_bays (kerbsideid → roadsegmentid)
    → parking_zones_to_segments (segment_id → parkingzone)
    → sign_plates (parkingzone → restriction rules)

This script:
  1. Loads existing bronze/silver data
  2. Fetches the two new datasets (parking zones, sign plates)
  3. Tests each link in the chain and reports overlap numbers
  4. Compares old coverage vs new coverage

Run from repo root:
    python scripts/validate_segment_join.py

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
log = logging.getLogger("validate_segment_join")

ROOT = Path(__file__).resolve().parent.parent
BRONZE_DIR = ROOT / "data" / "bronze"
SILVER_DIR = ROOT / "data" / "silver"

API_BASE = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
PAGE_SIZE = 100
MAX_OFFSET = 15_000  # some datasets are larger


def fetch_all(dataset_id: str) -> pd.DataFrame:
    """Paginate through a CoM dataset and return a DataFrame."""
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
        if offset % 500 == 0:
            log.info("  %s: %d records so far", dataset_id, len(records))
    df = pd.DataFrame(records)
    log.info("  Fetched %s: %d records, %d columns", dataset_id, len(df), len(df.columns))
    return df


def load_local(filename: str, directory: Path) -> pd.DataFrame:
    """Load a parquet file from bronze or silver."""
    path = directory / filename
    if not path.exists():
        log.error("File not found: %s", path)
        sys.exit(1)
    df = pd.read_parquet(path)
    log.info("Loaded %s: %d rows", filename, len(df))
    return df


def main():
    print("=" * 70)
    print("MeloPark — Street-segment join chain validation")
    print("=" * 70)

    # ── Step 1: Load existing local data ─────────────────────────────────

    print("\n--- Step 1: Loading existing bronze/silver data ---")

    sensors = load_local("sensors_clean.parquet", SILVER_DIR)
    sensors["bay_id"] = sensors["bay_id"].astype(str).str.strip()

    pbays = load_local("parking_bays.parquet", BRONZE_DIR)
    # parking_bays uses kerbsideid — same namespace as sensors
    pbays["bay_id"] = pbays["kerbsideid"].astype(str).str.strip()
    if "roadsegmentid" in pbays.columns:
        pbays["roadsegmentid"] = pbays["roadsegmentid"].astype(str).str.strip()

    restrictions = load_local("restrictions_long.parquet", SILVER_DIR)
    restrictions["bay_id"] = restrictions["bay_id"].astype(str).str.strip()

    # ── Step 2: Test link 1 — sensor → parking_bays (kerbsideid) ─────────

    print("\n--- Step 2: Link 1 — sensors → parking_bays via kerbsideid ---")

    sensor_ids = set(sensors["bay_id"].unique())
    pbay_ids = set(pbays["bay_id"].unique())
    link1_match = sensor_ids & pbay_ids
    link1_miss = sensor_ids - pbay_ids

    print(f"  Sensor bays:                {len(sensor_ids):,}")
    print(f"  Parking bays (bronze):      {len(pbay_ids):,}")
    print(f"  Matched (link 1):           {len(link1_match):,}  "
          f"({100 * len(link1_match) / len(sensor_ids):.1f}%)")
    print(f"  Sensors with no pbay match: {len(link1_miss):,}")

    # Check how many matched sensors have a roadsegmentid
    matched_pbays = pbays[pbays["bay_id"].isin(link1_match)]
    has_seg_id = matched_pbays["roadsegmentid"].notna() & (matched_pbays["roadsegmentid"] != "nan")
    print(f"  Of matched, have roadsegmentid: {has_seg_id.sum():,}")
    print(f"  Unique road segments:           {matched_pbays.loc[has_seg_id, 'roadsegmentid'].nunique():,}")

    sensor_segments = matched_pbays.loc[has_seg_id, ["bay_id", "roadsegmentid"]].copy()

    # ── Step 3: Fetch new datasets ───────────────────────────────────────

    print("\n--- Step 3: Fetching parking zones + sign plates from CoM ---")

    zones_to_segs = fetch_all("parking-zones-linked-to-street-segments")
    sign_plates = fetch_all("sign-plates-located-in-each-parking-zone")

    print(f"\n  Parking zones → segments: {len(zones_to_segs):,} rows")
    print(f"  Columns: {list(zones_to_segs.columns)}")
    print(f"\n  Sign plates in zones:     {len(sign_plates):,} rows")
    print(f"  Columns: {list(sign_plates.columns)}")

    # ── Step 4: Test link 2 — roadsegmentid → segment_id ────────────────

    print("\n--- Step 4: Link 2 — roadsegmentid → parking zones ---")

    # Identify the segment ID column in zones_to_segs
    seg_col_candidates = [c for c in zones_to_segs.columns
                          if "segment" in c.lower() and "id" in c.lower()]
    zone_col_candidates = [c for c in zones_to_segs.columns
                           if "zone" in c.lower() or "parking" in c.lower()]

    print(f"  Segment ID column candidates: {seg_col_candidates}")
    print(f"  Zone column candidates:       {zone_col_candidates}")

    if not seg_col_candidates:
        print("  ERROR: No segment_id column found in zones dataset.")
        print("  Available columns:", list(zones_to_segs.columns))
        return

    seg_col = seg_col_candidates[0]
    zone_col = zone_col_candidates[0] if zone_col_candidates else None

    zones_to_segs[seg_col] = zones_to_segs[seg_col].astype(str).str.strip()

    sensor_seg_ids = set(sensor_segments["roadsegmentid"].unique())
    zone_seg_ids = set(zones_to_segs[seg_col].unique())
    link2_match = sensor_seg_ids & zone_seg_ids
    link2_miss = sensor_seg_ids - zone_seg_ids

    print(f"\n  Sensor road segments:     {len(sensor_seg_ids):,}")
    print(f"  Zone-linked segments:     {len(zone_seg_ids):,}")
    print(f"  Matched (link 2):         {len(link2_match):,}  "
          f"({100 * len(link2_match) / max(len(sensor_seg_ids), 1):.1f}%)")
    print(f"  Sensor segments not in zones: {len(link2_miss):,}")

    # How many sensor BAYS does that cover?
    bays_with_zone = sensor_segments[
        sensor_segments["roadsegmentid"].isin(link2_match)
    ]["bay_id"].nunique()
    print(f"  Sensor bays reachable via zones: {bays_with_zone:,} / {len(sensor_ids):,}  "
          f"({100 * bays_with_zone / len(sensor_ids):.1f}%)")

    # ── Step 5: Test link 3 — parkingzone → sign plates ─────────────────

    print("\n--- Step 5: Link 3 — parking zones → sign plate restrictions ---")

    if zone_col:
        zones_to_segs[zone_col] = zones_to_segs[zone_col].astype(str).str.strip()
        matched_zones = zones_to_segs[zones_to_segs[seg_col].isin(link2_match)]
        reachable_zones = set(matched_zones[zone_col].unique())

        # Find zone column in sign_plates
        sp_zone_candidates = [c for c in sign_plates.columns
                              if "zone" in c.lower() or "parking" in c.lower()]
        print(f"  Sign plate zone column candidates: {sp_zone_candidates}")

        if sp_zone_candidates:
            sp_zone_col = sp_zone_candidates[0]
            sign_plates[sp_zone_col] = sign_plates[sp_zone_col].astype(str).str.strip()
            sp_zones = set(sign_plates[sp_zone_col].unique())
            link3_match = reachable_zones & sp_zones
            link3_miss = reachable_zones - sp_zones

            print(f"\n  Reachable parking zones:    {len(reachable_zones):,}")
            print(f"  Zones with sign plates:     {len(sp_zones):,}")
            print(f"  Matched (link 3):           {len(link3_match):,}  "
                  f"({100 * len(link3_match) / max(len(reachable_zones), 1):.1f}%)")
            print(f"  Zones with no sign plates:  {len(link3_miss):,}")

            # Final coverage: how many sensor bays can we give rules to?
            segs_with_full_chain = matched_zones[
                matched_zones[zone_col].isin(link3_match)
            ][seg_col].unique()
            final_bays = sensor_segments[
                sensor_segments["roadsegmentid"].isin(segs_with_full_chain)
            ]["bay_id"].nunique()

            # Show sample sign plate data
            restriction_cols = [c for c in sign_plates.columns
                                if "restrict" in c.lower() or "display" in c.lower()
                                or "desc" in c.lower()]
            if restriction_cols:
                sample = sign_plates[sign_plates[sp_zone_col].isin(link3_match)].head(5)
                print(f"\n  Sample sign plate restrictions ({restriction_cols[0]}):")
                for _, row in sample.iterrows():
                    print(f"    Zone {row[sp_zone_col]}: {row.get(restriction_cols[0], 'N/A')}")
        else:
            final_bays = 0
            print("  ERROR: No zone column found in sign plates dataset.")
    else:
        final_bays = 0
        print("  ERROR: No zone column found in zones-to-segments dataset.")

    # ── Step 6: Compare old vs new coverage ──────────────────────────────

    print("\n" + "=" * 70)
    print("COVERAGE COMPARISON")
    print("=" * 70)

    # Old coverage: direct sensor → restrictions join
    old_match = sensor_ids & set(restrictions["bay_id"].unique())

    print(f"\n  Total sensor bays:                        {len(sensor_ids):,}")
    print(f"  OLD (direct bay_id join):                 {len(old_match):,}  "
          f"({100 * len(old_match) / len(sensor_ids):.1f}%)")
    print(f"  NEW (street-segment chain):               {final_bays:,}  "
          f"({100 * final_bays / len(sensor_ids):.1f}%)")
    print(f"  Coverage improvement:                     "
          f"{final_bays - len(old_match):+,} bays")

    improvement = (final_bays / max(len(old_match), 1))
    print(f"  Multiplier:                               {improvement:.1f}x")

    # ── Step 7: Save diagnostic output ───────────────────────────────────

    output = {
        "total_sensor_bays": len(sensor_ids),
        "link1_sensors_to_pbays": len(link1_match),
        "link1_with_roadsegmentid": int(has_seg_id.sum()),
        "unique_road_segments": int(
            matched_pbays.loc[has_seg_id, "roadsegmentid"].nunique()
        ),
        "link2_segments_to_zones": len(link2_match),
        "bays_reachable_via_zones": bays_with_zone,
        "link3_zones_to_signplates": len(link3_match) if zone_col else 0,
        "final_bays_with_rules": final_bays,
        "old_coverage_direct_join": len(old_match),
        "coverage_improvement_bays": final_bays - len(old_match),
    }

    out_path = ROOT / "data" / "segment_join_validation.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n  Diagnostics saved to {out_path}")


if __name__ == "__main__":
    main()
