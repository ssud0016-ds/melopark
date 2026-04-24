"""
validate_segment_join_v2.py
===========================
Follow-up diagnostic after v1 showed link 1 as the bottleneck:
only 1,377 of 3,309 sensors matched parking_bays because bronze
only fetched 10k of ~23k rows.

This script:
  1. Fetches the FULL parking_bays dataset (raises offset cap to 25k)
  2. Tests kerbsideid join AND marker_id join (CoM docs say sensors
     join to parking_bays via marker_id)
  3. Checks for formatting mismatches (padding, whitespace, case)
  4. Reruns the full segment chain with the complete data
  5. Reports final coverage numbers

Run from repo root:
    python scripts/validate_segment_join_v2.py

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
log = logging.getLogger("validate_v2")

ROOT = Path(__file__).resolve().parent.parent
BRONZE_DIR = ROOT / "data" / "bronze"
SILVER_DIR = ROOT / "data" / "silver"

API_BASE = "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
PAGE_SIZE = 100
MAX_OFFSET = 25_000  # bumped from 10k to cover full parking_bays


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
        if offset % 1000 == 0:
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


def normalise(series: pd.Series) -> pd.Series:
    """Strip, lowercase, remove leading zeros for numeric-looking IDs."""
    s = series.astype(str).str.strip().str.lower()
    # Try to normalise numeric IDs (remove leading zeros)
    numeric_mask = s.str.match(r"^\d+$")
    s[numeric_mask] = s[numeric_mask].apply(lambda x: str(int(x)))
    return s


def main():
    print("=" * 70)
    print("MeloPark — Segment join validation v2 (full parking_bays fetch)")
    print("=" * 70)

    # ── Step 1: Load sensors from silver ─────────────────────────────────

    print("\n--- Step 1: Loading sensor data from silver ---")
    sensors = load_local("sensors_clean.parquet", SILVER_DIR)
    sensors["bay_id"] = sensors["bay_id"].astype(str).str.strip()

    # Also grab raw sensor columns that might have marker_id
    sensors_raw = load_local("sensors.parquet", BRONZE_DIR)
    print(f"  Raw sensor columns: {list(sensors_raw.columns)}")

    # Check for marker_id or st_marker_id in raw sensors
    marker_cols = [c for c in sensors_raw.columns
                   if "marker" in c.lower() or "st_marker" in c.lower()]
    print(f"  Marker ID columns found: {marker_cols}")

    # ── Step 2: Load FULL parking_bays from local CSV ──────────────────

    print("\n--- Step 2: Loading FULL parking_bays from CSV ---")
    pbays_csv_path = ROOT / "data" / "on-street-parking-bays.csv"
    if not pbays_csv_path.exists():
        log.error("Parking bays CSV not found at %s", pbays_csv_path)
        log.error("Download from CoM portal and place at: data/on-street-parking-bays.csv")
        sys.exit(1)
    pbays_full = pd.read_csv(pbays_csv_path, sep=None, engine="python")
    # If only 1 column was detected, the delimiter guess failed — try semicolon
    if len(pbays_full.columns) <= 2:
        pbays_full = pd.read_csv(pbays_csv_path, sep=";")
    print(f"  Total rows fetched: {len(pbays_full):,}")
    print(f"  Columns: {list(pbays_full.columns)}")

    # Identify key columns
    kerb_col = None
    marker_col = None
    seg_col = None
    for c in pbays_full.columns:
        cl = c.lower()
        if "kerbside" in cl:
            kerb_col = c
        if "marker" in cl:
            marker_col = c
        if "roadsegment" in cl and "id" in cl and "desc" not in cl:
            seg_col = c

    print(f"\n  kerbsideid column:        {kerb_col}")
    print(f"  marker_id column:         {marker_col}")
    print(f"  roadsegmentid column:     {seg_col}")

    # ── Step 3: Test kerbsideid join (same as v1 but with full data) ────

    print("\n--- Step 3: kerbsideid join (full 23k parking_bays) ---")

    sensor_ids = set(sensors["bay_id"].unique())

    if kerb_col:
        pbays_full["_kerb_norm"] = normalise(pbays_full[kerb_col])
        sensors["_bay_norm"] = normalise(sensors["bay_id"])

        pbay_kerb_ids = set(pbays_full["_kerb_norm"].unique())
        sensor_norm_ids = set(sensors["_bay_norm"].unique())

        kerb_match = sensor_norm_ids & pbay_kerb_ids
        kerb_miss = sensor_norm_ids - pbay_kerb_ids

        print(f"  Sensor bays (normalised):       {len(sensor_norm_ids):,}")
        print(f"  Parking bays kerbsideid:        {len(pbay_kerb_ids):,}")
        print(f"  Matched via kerbsideid:         {len(kerb_match):,}  "
              f"({100 * len(kerb_match) / len(sensor_norm_ids):.1f}%)")
        print(f"  Sensors with no kerb match:     {len(kerb_miss):,}")

        # Show sample misses
        miss_sample = list(kerb_miss)[:10]
        print(f"  Sample unmatched sensor IDs:    {miss_sample}")
    else:
        kerb_match = set()
        print("  No kerbsideid column found in parking_bays!")

    # ── Step 4: Test marker_id join ─────────────────────────────────────

    print("\n--- Step 4: marker_id join path ---")

    if marker_col and marker_cols:
        sensor_marker_col = marker_cols[0]
        sensors_raw["_marker_norm"] = normalise(sensors_raw[sensor_marker_col])
        pbays_full["_marker_norm"] = normalise(pbays_full[marker_col])

        sensor_marker_ids = set(sensors_raw["_marker_norm"].dropna().unique())
        pbay_marker_ids = set(pbays_full["_marker_norm"].dropna().unique())

        marker_match = sensor_marker_ids & pbay_marker_ids
        marker_miss = sensor_marker_ids - pbay_marker_ids

        print(f"  Sensor marker IDs:              {len(sensor_marker_ids):,}")
        print(f"  Parking bay marker IDs:         {len(pbay_marker_ids):,}")
        print(f"  Matched via marker_id:          {len(marker_match):,}  "
              f"({100 * len(marker_match) / max(len(sensor_marker_ids), 1):.1f}%)")

        # How many of the kerb_miss can be recovered via marker_id?
        # Build a mapping: sensor raw row → kerbsideid + marker_id
        sensors_raw["_kerb_norm"] = normalise(
            sensors_raw["kerbsideid"] if "kerbsideid" in sensors_raw.columns
            else sensors_raw.get("bay_id", pd.Series(dtype=str))
        )
        missed_sensors = sensors_raw[~sensors_raw["_kerb_norm"].isin(kerb_match)]
        recovered_via_marker = missed_sensors[
            missed_sensors["_marker_norm"].isin(pbay_marker_ids)
        ]
        print(f"  Kerb-missed sensors recovered via marker: {len(recovered_via_marker):,}")
    elif marker_col:
        print(f"  Parking bays has {marker_col} but sensors lack a marker column.")
        print(f"  Sensor columns: {list(sensors_raw.columns)}")
    else:
        print("  No marker_id column in parking_bays dataset.")

    # ── Step 5: Combined match — union of kerbsideid + marker_id ────────

    print("\n--- Step 5: Combined sensor → parking_bays match ---")

    # Build the best possible mapping: sensor bay_id → roadsegmentid
    if kerb_col and seg_col:
        # Start with kerbsideid matches
        kerb_lookup = pbays_full[pbays_full["_kerb_norm"].isin(kerb_match)][
            ["_kerb_norm", seg_col]
        ].drop_duplicates("_kerb_norm")
        kerb_lookup.columns = ["_sensor_norm", "roadsegmentid"]

        # Add marker_id matches for sensors that didn't match on kerbsideid
        if marker_col and marker_cols:
            # For each marker-matched sensor, get its kerbsideid and the
            # parking bay's roadsegmentid
            marker_bridge = recovered_via_marker.merge(
                pbays_full[["_marker_norm", seg_col]].drop_duplicates("_marker_norm"),
                on="_marker_norm",
                how="inner",
            )
            if len(marker_bridge) > 0:
                marker_lookup = marker_bridge[["_kerb_norm", seg_col]].copy()
                marker_lookup.columns = ["_sensor_norm", "roadsegmentid"]
                combined_lookup = pd.concat(
                    [kerb_lookup, marker_lookup], ignore_index=True
                ).drop_duplicates("_sensor_norm")
            else:
                combined_lookup = kerb_lookup
        else:
            combined_lookup = kerb_lookup

        combined_lookup["roadsegmentid"] = (
            combined_lookup["roadsegmentid"].astype(str).str.strip()
        )
        has_seg = combined_lookup["roadsegmentid"].notna() & (
            combined_lookup["roadsegmentid"] != "nan"
        ) & (combined_lookup["roadsegmentid"] != "None")

        total_matched = len(combined_lookup)
        with_seg = has_seg.sum()
        unique_segs = combined_lookup.loc[has_seg, "roadsegmentid"].nunique()

        print(f"  Total sensors matched to parking_bays: {total_matched:,}  "
              f"({100 * total_matched / len(sensor_ids):.1f}%)")
        print(f"  Of those, with roadsegmentid:          {with_seg:,}")
        print(f"  Unique road segments:                  {unique_segs:,}")
    else:
        print("  Cannot build combined lookup — missing columns.")
        combined_lookup = pd.DataFrame(columns=["_sensor_norm", "roadsegmentid"])
        has_seg = pd.Series(dtype=bool)

    # ── Step 6: Run full chain with combined data ───────────────────────

    print("\n--- Step 6: Full segment chain (zones + sign plates) ---")

    zones_to_segs = fetch_all("parking-zones-linked-to-street-segments")
    sign_plates = fetch_all("sign-plates-located-in-each-parking-zone")

    print(f"  Zones → segments: {len(zones_to_segs):,} rows, cols: {list(zones_to_segs.columns)}")
    print(f"  Sign plates:      {len(sign_plates):,} rows, cols: {list(sign_plates.columns)}")

    # Find column names
    z_seg_col = next((c for c in zones_to_segs.columns if "segment" in c.lower() and "id" in c.lower()), None)
    z_zone_col = next((c for c in zones_to_segs.columns if "zone" in c.lower() or "parking" in c.lower()), None)
    sp_zone_col = next((c for c in sign_plates.columns if "zone" in c.lower() or "parking" in c.lower()), None)

    print(f"\n  Zones segment col: {z_seg_col}")
    print(f"  Zones zone col:    {z_zone_col}")
    print(f"  Sign plates zone col: {sp_zone_col}")

    if z_seg_col and z_zone_col and sp_zone_col:
        zones_to_segs[z_seg_col] = zones_to_segs[z_seg_col].astype(str).str.strip()
        zones_to_segs[z_zone_col] = zones_to_segs[z_zone_col].astype(str).str.strip()
        sign_plates[sp_zone_col] = sign_plates[sp_zone_col].astype(str).str.strip()

        sensor_seg_ids = set(
            combined_lookup.loc[has_seg, "roadsegmentid"].unique()
        )
        zone_seg_ids = set(zones_to_segs[z_seg_col].unique())

        link2_match = sensor_seg_ids & zone_seg_ids
        print(f"\n  Link 2 — roadsegmentid → zones:")
        print(f"    Sensor road segments:     {len(sensor_seg_ids):,}")
        print(f"    Zone-linked segments:     {len(zone_seg_ids):,}")
        print(f"    Matched:                  {len(link2_match):,}  "
              f"({100 * len(link2_match) / max(len(sensor_seg_ids), 1):.1f}%)")

        bays_via_zones = combined_lookup[
            combined_lookup["roadsegmentid"].isin(link2_match)
        ]["_sensor_norm"].nunique()
        print(f"    Sensor bays reachable:    {bays_via_zones:,}")

        # Link 3: zones → sign plates
        matched_zones_df = zones_to_segs[zones_to_segs[z_seg_col].isin(link2_match)]
        reachable_zones = set(matched_zones_df[z_zone_col].unique())
        sp_zones = set(sign_plates[sp_zone_col].unique())
        link3_match = reachable_zones & sp_zones

        print(f"\n  Link 3 — parkingzone → sign plates:")
        print(f"    Reachable zones:          {len(reachable_zones):,}")
        print(f"    Zones with sign plates:   {len(sp_zones):,}")
        print(f"    Matched:                  {len(link3_match):,}  "
              f"({100 * len(link3_match) / max(len(reachable_zones), 1):.1f}%)")

        # Final coverage
        segs_full_chain = matched_zones_df[
            matched_zones_df[z_zone_col].isin(link3_match)
        ][z_seg_col].unique()
        final_bays = combined_lookup[
            combined_lookup["roadsegmentid"].isin(segs_full_chain)
        ]["_sensor_norm"].nunique()

        # Show sample restrictions
        restriction_cols = [c for c in sign_plates.columns
                            if "restrict" in c.lower() or "display" in c.lower()
                            or "desc" in c.lower()]
        if restriction_cols:
            sample = sign_plates[sign_plates[sp_zone_col].isin(link3_match)].head(8)
            print(f"\n  Sample sign plate data:")
            for _, row in sample.iterrows():
                zone = row[sp_zone_col]
                rest = row.get(restriction_cols[0], "N/A")
                print(f"    Zone {zone}: {rest}")
    else:
        final_bays = 0
        bays_via_zones = 0
        link2_match = set()
        link3_match = set()
        print("  ERROR: Missing columns in zones or sign plates datasets.")

    # ── Step 7: Also check the direct restrictions overlap ──────────────

    print("\n--- Step 7: Direct restrictions join (for comparison) ---")
    restrictions = load_local("restrictions_long.parquet", SILVER_DIR)
    restrictions["bay_id"] = restrictions["bay_id"].astype(str).str.strip()
    restrictions["_bay_norm"] = normalise(restrictions["bay_id"])

    old_match = sensor_norm_ids & set(restrictions["_bay_norm"].unique())
    print(f"  Direct join matches (normalised): {len(old_match):,}")

    # ── Summary ─────────────────────────────────────────────────────────

    print("\n" + "=" * 70)
    print("FINAL COVERAGE COMPARISON")
    print("=" * 70)
    print(f"\n  Total sensor bays:                       {len(sensor_ids):,}")
    print(f"  Parking bays fetched (full):             {len(pbays_full):,}")
    print(f"  Sensors matched to parking_bays:         {total_matched:,}  "
          f"({100 * total_matched / len(sensor_ids):.1f}%)")
    print(f"")
    print(f"  OLD coverage (direct bay_id join):       {len(old_match):,}  "
          f"({100 * len(old_match) / len(sensor_ids):.1f}%)")
    print(f"  NEW coverage (segment chain):            {final_bays:,}  "
          f"({100 * final_bays / len(sensor_ids):.1f}%)")
    print(f"  Improvement:                             "
          f"{final_bays - len(old_match):+,} bays")
    print(f"  Coverage ratio:                          "
          f"{100 * final_bays / len(sensor_ids):.1f}%")
    print(f"")
    # Combined: union of direct-join bays + segment-chain bays
    try:
        segment_bay_ids = set(
            combined_lookup[
                combined_lookup["roadsegmentid"].isin(segs_full_chain)
            ]["_sensor_norm"].unique()
        )
    except NameError:
        segment_bay_ids = set()
    combined_total = len(old_match | segment_bay_ids)
    print(f"  COMBINED (direct + segment):             {combined_total:,}  "
          f"({100 * combined_total / len(sensor_ids):.1f}%)")

    # ── Save results ────────────────────────────────────────────────────

    output = {
        "total_sensor_bays": len(sensor_ids),
        "parking_bays_fetched": len(pbays_full),
        "link1_kerbsideid_match": len(kerb_match),
        "link1_marker_id_match": len(marker_match) if marker_col and marker_cols else "N/A",
        "link1_marker_recovered": len(recovered_via_marker) if marker_col and marker_cols else "N/A",
        "combined_sensor_to_pbay": total_matched,
        "with_roadsegmentid": int(with_seg),
        "unique_road_segments": unique_segs,
        "link2_segments_to_zones": len(link2_match),
        "bays_reachable_via_zones": bays_via_zones,
        "link3_zones_to_signplates": len(link3_match),
        "final_bays_segment_chain": final_bays,
        "old_coverage_direct_join": len(old_match),
        "coverage_improvement_bays": final_bays - len(old_match),
        "final_coverage_pct": round(100 * final_bays / len(sensor_ids), 1),
    }

    out_path = ROOT / "data" / "segment_join_validation_v2.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w") as f:
        json.dump(output, f, indent=2)
    print(f"\n  Results saved to {out_path}")

    # Also save the combined lookup for pipeline integration
    lookup_path = ROOT / "data" / "sensor_to_segment_lookup.csv"
    combined_lookup.to_csv(lookup_path, index=False)
    print(f"  Sensor → segment lookup saved to {lookup_path}")
    print(f"  (Use this to build the new silver layer)")


if __name__ == "__main__":
    main()
