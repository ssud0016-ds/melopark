"""Bug 9 audit — quantify the LZ/DP segment-inheritance coverage gap.

Context
-------
``scripts/clean_to_silver.py:775`` deliberately skips sign-plate rows whose
``display_code`` starts with ``LZ`` (Loading Zone) or ``DP`` (Disabled
Parking) when fanning plates from a parkingzone down onto individual bays.
The guard prevents a single bay-specific LZ plate from being wrongly
applied to every bay on its segment.

But for any bay whose ``kerbsideid`` does not appear in CoM's bay-specific
``on-street-car-park-bay-restrictions`` feed, segment inheritance is the
only source of restriction rows — so the LZ/DP designation on those bays
vanishes entirely (see bay 60956 as the canonical example).

Goal
----
Produce a CSV that tells the team, for each (parkingzone × LZ/DP plate):
  - how many bays sit on the parkingzone's segments
  - whether the parkingzone holds **only** LZ/DP plates (uniform → safe to
    fan out across the zone)
  - whether every parkingzone on the segment is uniform LZ/DP (segment-wide
    safe to fan out)
  - a sample of candidate bay_ids for Street-View spot-checking

Output
------
``docs/audits/lz_dp_coverage_gap_<YYYY-MM-DD>.csv`` — one row per
(parkingzone, display_code, restriction_days, time_start, time_finish).

How to run
----------
    python scripts/audit/lz_dp_coverage_gap.py

No CLI flags. Reads parquet from ``data/bronze/``. Safe to re-run; always
overwrites today's dated CSV.
"""

from __future__ import annotations

import datetime as _dt
import logging
import sys
from pathlib import Path

import pandas as pd

# Allow "python scripts/audit/..." invocation from the repo root.
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("lz_dp_audit")

BRONZE_DIR = REPO_ROOT / "data" / "bronze"
AUDIT_OUT_DIR = REPO_ROOT / "docs" / "audits"

LZ_DP_PREFIXES: tuple[str, ...] = ("LZ", "DP")


def _load_bronze() -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    signs = pd.read_parquet(BRONZE_DIR / "sign_plates.parquet")
    zones = pd.read_parquet(BRONZE_DIR / "zones_to_segments.parquet")
    bays = pd.read_parquet(BRONZE_DIR / "parking_bays.parquet")

    signs = signs.copy()
    signs["display_code_upper"] = signs["restriction_display"].astype(str).str.strip().str.upper()

    zones = zones.copy()
    bays = bays.copy()
    bays["kerbsideid"] = bays["kerbsideid"].astype(str)
    return signs, zones, bays


def _zone_is_uniform_lz_dp(zone_signs: pd.DataFrame) -> bool:
    """True if **every** plate on this parkingzone is LZ/DP."""
    codes = zone_signs["display_code_upper"].tolist()
    if not codes:
        return False
    return all(c.startswith(LZ_DP_PREFIXES) for c in codes)


def build_audit(
    signs: pd.DataFrame, zones: pd.DataFrame, bays: pd.DataFrame
) -> pd.DataFrame:
    lz_dp = signs[signs["display_code_upper"].str.startswith(LZ_DP_PREFIXES)].copy()
    log.info(
        "Source: %d LZ/DP plate rows across %d distinct parkingzones.",
        len(lz_dp),
        lz_dp["parkingzone"].nunique(),
    )

    zone_uniform = (
        signs.groupby("parkingzone", dropna=False)
        .apply(_zone_is_uniform_lz_dp, include_groups=False)
        .rename("zone_is_uniform_lz_dp")
        .reset_index()
    )

    lz_dp = lz_dp.merge(zone_uniform, on="parkingzone", how="left")

    # Attach every segment that each parkingzone touches.
    zone_segments = zones[["parkingzone", "segment_id"]].drop_duplicates()
    lz_dp = lz_dp.merge(zone_segments, on="parkingzone", how="left")

    # For each segment, check if *all* its parkingzones are uniform LZ/DP.
    seg_uniform = (
        zone_uniform.merge(zone_segments, on="parkingzone", how="inner")
        .groupby("segment_id")["zone_is_uniform_lz_dp"]
        .all()
        .rename("segment_is_uniform_lz_dp")
        .reset_index()
    )
    lz_dp = lz_dp.merge(seg_uniform, on="segment_id", how="left")

    # Count bays + sample kerbsideids per segment.
    seg_to_bays = (
        bays[["roadsegmentid", "kerbsideid"]]
        .rename(columns={"roadsegmentid": "segment_id"})
        .dropna(subset=["kerbsideid"])
        .drop_duplicates()
    )
    seg_to_bays["kerbsideid"] = seg_to_bays["kerbsideid"].astype(str)

    def _summarise_group(s: pd.Series) -> pd.Series:
        ids = sorted(s.dropna().astype(str).tolist())
        return pd.Series({"bay_count": len(ids), "sample_bay_ids": ",".join(ids[:5])})

    bay_counts = (
        seg_to_bays.groupby("segment_id")["kerbsideid"]
        .apply(_summarise_group)
        .unstack()
        .reset_index()
    )
    lz_dp = lz_dp.merge(bay_counts, on="segment_id", how="left")

    # Final output frame.
    out = lz_dp[
        [
            "parkingzone",
            "segment_id",
            "restriction_display",
            "restriction_days",
            "time_restrictions_start",
            "time_restrictions_finish",
            "zone_is_uniform_lz_dp",
            "segment_is_uniform_lz_dp",
            "bay_count",
            "sample_bay_ids",
        ]
    ].sort_values(
        by=["segment_is_uniform_lz_dp", "zone_is_uniform_lz_dp", "parkingzone", "restriction_display"],
        ascending=[False, False, True, True],
    )
    out["bay_count"] = out["bay_count"].fillna(0).astype(int)
    return out


def summarise(out: pd.DataFrame) -> None:
    total = len(out)
    seg_safe = out["segment_is_uniform_lz_dp"].fillna(False).sum()
    zone_safe = out["zone_is_uniform_lz_dp"].fillna(False).sum()
    n_segments_safe = out[out["segment_is_uniform_lz_dp"].fillna(False)]["segment_id"].nunique()
    bays_on_safe_segments = (
        out[out["segment_is_uniform_lz_dp"].fillna(False)][["segment_id", "bay_count"]]
        .drop_duplicates(subset=["segment_id"])["bay_count"]
        .sum()
    )

    log.info("=" * 60)
    log.info("LZ/DP coverage gap audit summary")
    log.info("-" * 60)
    log.info("LZ/DP plate rows: %d", total)
    log.info("  on segment-uniform segments:   %d (%.1f%%)", seg_safe, 100 * seg_safe / max(total, 1))
    log.info("  on zone-uniform parkingzones:  %d (%.1f%%)", zone_safe, 100 * zone_safe / max(total, 1))
    log.info("Distinct segments that are fully LZ/DP-uniform: %d", n_segments_safe)
    log.info(
        "Bays that would GAIN an LZ/DP rule under Option A (segment-uniform only): %d",
        int(bays_on_safe_segments),
    )
    log.info("=" * 60)


def main() -> int:
    signs, zones, bays = _load_bronze()
    out = build_audit(signs, zones, bays)

    AUDIT_OUT_DIR.mkdir(parents=True, exist_ok=True)
    today = _dt.date.today().isoformat()
    out_path = AUDIT_OUT_DIR / f"lz_dp_coverage_gap_{today}.csv"
    out.to_csv(out_path, index=False)
    log.info("Wrote %s (%d rows).", out_path.relative_to(REPO_ROOT), len(out))

    summarise(out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
