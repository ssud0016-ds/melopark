"""
Missing-rule diagnostics and safe incremental recovery (Bug 1 follow-up).

Does not change LZ/DP uniform or segment ``continue`` behaviour; reuses
``restrictions_from_synthetic_joined`` for the same skip rules as the main chain.
"""

from __future__ import annotations

import logging
import math
import re
from pathlib import Path
from typing import Any

import pandas as pd

log = logging.getLogger("clean_to_silver")

ROOT = Path(__file__).resolve().parent.parent
DIAGNOSTICS_DIR = ROOT / "data" / "diagnostics"

# Long restriction schema aligned with restrictions_long.parquet / segment_restrictions_long
SILVER_RESTRICTION_LONG_COLS: list[str] = [
    "bay_id",
    "restriction_bayid",
    "slot_num",
    "typedesc",
    "fromday",
    "today",
    "starttime",
    "endtime",
    "duration_mins",
    "disabilityext_mins",
]


def _empty_recovery_restrictions_long() -> pd.DataFrame:
    return pd.DataFrame(columns=SILVER_RESTRICTION_LONG_COLS)


def _normalize_recovery_restrictions_long(df: pd.DataFrame | None) -> pd.DataFrame:
    if df is None or len(df) == 0:
        return _empty_recovery_restrictions_long()
    out = df.drop(
        columns=[c for c in df.columns if c not in SILVER_RESTRICTION_LONG_COLS],
        errors="ignore",
    )
    for c in SILVER_RESTRICTION_LONG_COLS:
        if c not in out.columns:
            out[c] = pd.NA
    return out[SILVER_RESTRICTION_LONG_COLS].copy()


# Category C: remap orphan roadsegment → nearest known segment (centroid match)
MAX_SEGMENT_REMAP_M = 75.0
# Category A / B: nearest on-network bay in bay_zones
MAX_NEAREST_BAY_REF_M = 50.0
# Category A: explicit allowlist for narrow (50, 60] m fallback with extra gates
A_BORDERLINE_50_60_BAY_IDS = frozenset({"67428", "67429"})
A_BORDERLINE_MAX_M = 60.0


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in metres (WGS84 sphere)."""
    if any(
        x is None or (isinstance(x, float) and math.isnan(x))
        for x in (lat1, lon1, lat2, lon2)
    ):
        return float("inf")
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(min(1.0, math.sqrt(a)))


def _norm_street_label(text: object) -> str:
    """Loose normalisation for same-street checks (kerb description vs zones.onstreet)."""
    if text is None or (isinstance(text, float) and pd.isna(text)):
        return ""
    s = str(text).strip().lower()
    s = re.sub(r"\s+between\s+.*$", "", s)
    s = re.sub(r"^intersection of\s+", "", s)
    s = re.sub(r"\s+and\s+.*$", "", s)
    return re.sub(r"[^a-z0-9]+", " ", s).strip()


def _c_orig_street_text(
    bays_clean: pd.DataFrame, bay_id: str, street_fallback: object,
) -> str:
    bm = bays_clean[bays_clean["bay_id"].astype(str).str.strip() == str(bay_id).strip()]
    if not bm.empty and "roadsegmentdescription" in bm.columns:
        d = bm.iloc[0].get("roadsegmentdescription")
        if d is not None and str(d).strip():
            return str(d).strip()
    if street_fallback is None or (isinstance(street_fallback, float) and pd.isna(street_fallback)):
        return ""
    return str(street_fallback).strip()


def _primary_onstreet_for_segment(zones: pd.DataFrame, segment_id: str) -> str:
    if "onstreet" not in zones.columns:
        return ""
    z = zones[zones["segment_id"].astype(str).str.strip() == str(segment_id).strip()]
    if z.empty:
        return ""
    o = z["onstreet"].dropna().astype(str).str.strip()
    o = o[o != ""]
    if o.empty:
        return ""
    return str(o.iloc[0])


def _c_same_street(orig_description: str, matched_seg: str, zones: pd.DataFrame) -> bool:
    on = _primary_onstreet_for_segment(zones, matched_seg)
    a = _norm_street_label(orig_description)
    b = _norm_street_label(on)
    if not a or not b:
        return False
    if a in b or b in a:
        return True
    atoks = a.split()
    btoks = b.split()
    if atoks and btoks and atoks[0] == btoks[0]:
        return True
    return False


def _merged_rule_fingerprint(merged: pd.DataFrame, bay_id: str) -> frozenset[tuple]:
    m = merged[
        (merged["bay_id"].astype(str).str.strip() == str(bay_id).strip())
        & merged["typedesc"].notna()
    ]
    if m.empty:
        return frozenset()
    cols = ["typedesc", "fromday", "today", "starttime", "endtime", "duration_mins"]
    for c in cols:
        if c not in m.columns:
            return frozenset()
    rows = m[cols].drop_duplicates()
    return frozenset(map(tuple, rows.to_records(index=False)))


def _c_segment_merged_rules_consistent(
    merged: pd.DataFrame, bays_clean: pd.DataFrame, segment_id: str,
) -> bool:
    """True if no typedesc on segment in merged, or a single restriction fingerprint across bays."""
    if "roadsegmentid" not in bays_clean.columns:
        return True
    bc = bays_clean[bays_clean["roadsegmentid"].astype(str).str.strip() == str(segment_id).strip()]
    fps: list[frozenset[tuple]] = []
    for bid in bc["bay_id"].astype(str).unique():
        fp = _merged_rule_fingerprint(merged, str(bid))
        if fp:
            fps.append(fp)
    if not fps:
        return True
    return len(set(fps)) <= 1


def _sensor_lat_lon(sensors_clean: pd.DataFrame, bay_id: str) -> tuple[float | None, float | None]:
    row = sensors_clean.loc[sensors_clean["bay_id"].astype(str).str.strip() == bay_id]
    if row.empty:
        return None, None
    lat = row.iloc[0].get("lat")
    lon = row.iloc[0].get("lon")
    try:
        return float(lat), float(lon)
    except (TypeError, ValueError):
        return None, None


def missing_bay_ids_from_merged(merged: pd.DataFrame) -> set[str]:
    has_td = merged.groupby(merged["bay_id"].astype(str))["typedesc"].apply(lambda s: s.notna().any())
    return set(has_td[~has_td].index.astype(str))


def _recovery_slot_count(val: object) -> int:
    """Parse recovery_typedesc_slots cell to int (0 if empty/invalid)."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return 0
    s = str(val).strip()
    if s == "" or s.lower() == "nan":
        return 0
    try:
        return int(float(s))
    except ValueError:
        return 0


def _unsafe_recovery_bay_ids(diag: pd.DataFrame) -> set[str]:
    """Strips recoveries with distance > 60 m or intersection in street (high-risk geometry)."""
    reject: set[str] = set()
    for _, r in diag.iterrows():
        if _recovery_slot_count(r.get("recovery_typedesc_slots")) <= 0:
            continue
        dist = pd.to_numeric(r.get("recovery_distance_m"), errors="coerce")
        st = r.get("street")
        street = "" if st is None or (isinstance(st, float) and pd.isna(st)) else str(st)
        unsafe_dist = pd.notna(dist) and float(dist) > 60.0
        unsafe_ix = "intersection" in street.lower()
        if unsafe_dist or unsafe_ix:
            reject.add(str(r["bay_id"]).strip())
    return reject


def apply_recovery_safety_strip(
    diag: pd.DataFrame,
    combined_restrictions: pd.DataFrame,
    merged: pd.DataFrame,
    sensors_clean: pd.DataFrame,
    cts: Any,
    prev_stats: dict[str, Any],
    verbose: bool = False,
    recovery_long: pd.DataFrame | None = None,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any], pd.DataFrame]:
    """
    Remove auto-recovered restriction rows for bays that fail post-audit safety rules.

    Rules (aligned with manual_review flags):
    - recovery_distance_m > 60
    - street text contains \"intersection\" (case-insensitive)

    ``recovery_long`` rows for stripped bay_ids are dropped so the silver sidecar
    matches ``combined_restrictions`` after strip.
    """
    recovery_long = _normalize_recovery_restrictions_long(recovery_long)

    reject = _unsafe_recovery_bay_ids(diag)
    patch: dict[str, Any] = {
        "recovery_safety_strip_bay_count": len(reject),
        "recovery_safety_strip_bay_ids": sorted(reject),
    }
    if not reject:
        patch["recovery_rows_after_safety_strip"] = len(recovery_long)
        return combined_restrictions, merged, patch, recovery_long

    stripped_rows = int(combined_restrictions["bay_id"].astype(str).isin(reject).sum())
    combined2 = combined_restrictions[~combined_restrictions["bay_id"].astype(str).isin(reject)].copy()
    merged2 = cts.join_silver(sensors_clean, combined2)

    m = diag["bay_id"].astype(str).isin(reject)
    for col in ("recovery_typedesc_slots", "matched_segment_id", "ref_bay_id", "recovery_distance_m"):
        if col in diag.columns:
            diag.loc[m, col] = ""
    if "recovery_method" in diag.columns:
        diag.loc[m, "recovery_method"] = "safety_stripped_unsafe_recovery"
    if "notes" in diag.columns:
        tail = " [Stripped unsafe auto-recovery: dist>60m or intersection street]"
        diag.loc[m, "notes"] = (
            diag.loc[m, "notes"].fillna("").astype(str).str.rstrip() + tail
        ).str.strip()

    missing_after = missing_bay_ids_from_merged(merged2)
    recovered_after = 0
    for _, r in diag.iterrows():
        if _recovery_slot_count(r.get("recovery_typedesc_slots")) > 0:
            recovered_after += 1

    recovery_long = recovery_long[~recovery_long["bay_id"].astype(str).isin(reject)].copy()

    patch.update(
        {
            "recovery_safety_strip_rows": stripped_rows,
            "recovery_rows_after_safety_strip": len(recovery_long),
            "recovered_bays": recovered_after,
            "missing_after": len(missing_after),
            "merged_row_count_post_recovery": len(merged2),
            "by_category_after": {
                str(k): int(v)
                for k, v in diag[diag["bay_id"].astype(str).isin(missing_after)]
                .groupby("category")
                .size()
                .items()
            },
        }
    )
    if verbose:
        log.info(
            "Recovery safety strip: removed %d rows for %d bays (dist>60m or intersection street)",
            stripped_rows,
            len(reject),
        )
    return combined2, merged2, patch, recovery_long


def classify_missing_rule_bays(
    sensors_clean: pd.DataFrame,
    bays_clean: pd.DataFrame,
    merged: pd.DataFrame,
    ctx: dict[str, Any] | None,
) -> pd.DataFrame:
    """
    Classify sensor bays with no typedesc in merged into A–D (+ O for other).

    A: not in parking_bays / bays_clean
    B: no roadsegmentid in bays_clean
    C: roadsegment not linked to zones_to_segments (or not in bay_zones)
    D: in bay_zones but parkingzone absent from sign_plates
    O: on-network with signs but still missing (e.g. only LZ/DP plates — still skipped)
    """
    missing = missing_bay_ids_from_merged(merged)
    bc = bays_clean.copy()
    bc["bay_id"] = bc["bay_id"].astype(str).str.strip()
    bc_map = bc.set_index("bay_id")

    street_col = "roadsegmentdescription" if "roadsegmentdescription" in bc.columns else None

    rows: list[dict] = []

    if ctx is None:
        for bid in sorted(missing):
            if bid not in bc_map.index:
                rows.append(
                    _row(bid, "A", None, None, None, "kerbside not in static parking_bays export"),
                )
            else:
                raw = bc_map.loc[bid]
                rs = raw.get("roadsegmentid")
                st = _street(raw, street_col)
                if pd.isna(rs) or str(rs).strip().lower() in ("", "nan", "none"):
                    rows.append(_row(bid, "B", None, None, st, "no roadsegmentid; segment ctx unavailable"))
                else:
                    rows.append(
                        _row(
                            bid,
                            "O",
                            str(rs).strip(),
                            None,
                            st,
                            "zones/sign join unavailable — cannot classify C vs D",
                        ),
                    )
        return pd.DataFrame(rows)

    zones: pd.DataFrame = ctx["zones"]
    bay_zones: pd.DataFrame = ctx["bay_zones"]
    signs: pd.DataFrame = ctx["signs"]

    valid_segments = set(zones["segment_id"].astype(str).str.strip())
    sign_zones = set(signs["parkingzone"].astype(str).str.strip())
    bz_by_bay = bay_zones.drop_duplicates(subset=["bay_id"]).copy()
    bz_by_bay["bay_id"] = bz_by_bay["bay_id"].astype(str).str.strip()
    bz_by_bay = bz_by_bay.set_index("bay_id")

    for bid in sorted(missing):
        if bid not in bc_map.index:
            rows.append(_row(bid, "A", None, None, None, "kerbside not in static parking_bays export"))
            continue
        raw = bc_map.loc[bid]
        rs = raw.get("roadsegmentid")
        street = _street(raw, street_col)
        if pd.isna(rs) or str(rs).strip().lower() in ("", "nan", "none"):
            rows.append(_row(bid, "B", None, None, street, "no roadsegmentid on bay row"))
            continue
        rs_str = str(rs).strip()
        if bid not in bz_by_bay.index:
            rows.append(
                _row(
                    bid,
                    "C",
                    rs_str,
                    None,
                    street,
                    "roadsegmentid not matched to zones_to_segments / bay_zones",
                )
            )
            continue
        pz = str(bz_by_bay.loc[bid, "parkingzone"]).strip()
        if pz not in sign_zones:
            rows.append(
                _row(
                    bid,
                    "D",
                    rs_str,
                    pz,
                    street,
                    "awaiting manual override — parkingzone has no sign_plates rows",
                )
            )
            continue
        rows.append(
            _row(
                bid,
                "O",
                rs_str,
                pz,
                street,
                "signs exist but no non-LZ/DP plates applied (same skip rules as segment chain)",
            )
        )
    return pd.DataFrame(rows)


def _row(
    bay_id: str,
    category: str,
    roadsegmentid,
    parkingzone,
    street,
    notes: str,
) -> dict:
    return {
        "bay_id": bay_id,
        "category": category,
        "roadsegmentid": roadsegmentid if roadsegmentid is None or pd.notna(roadsegmentid) else None,
        "parkingzone": parkingzone if parkingzone is None or pd.notna(parkingzone) else None,
        "street": street,
        "notes": notes,
        "recovery_method": "",
        "recovery_distance_m": "",
        "matched_segment_id": "",
        "ref_bay_id": "",
        "recovery_typedesc_slots": "",
    }


def _street(raw: pd.Series, street_col: str | None) -> str | None:
    if not street_col:
        return None
    v = raw.get(street_col)
    if pd.isna(v) or str(v).strip() == "":
        return None
    return str(v).strip()


def _segment_centroids(bays_clean: pd.DataFrame, valid_segments: set[str]) -> pd.DataFrame:
    bc = bays_clean.copy()
    bc["segment_id"] = bc["roadsegmentid"].astype(str).str.strip()
    bc = bc[bc["segment_id"].isin(valid_segments)]
    bc = bc[bc["lat"].notna() & bc["lon"].notna()]
    if bc.empty:
        return pd.DataFrame(columns=["segment_id", "lat_c", "lon_c"])
    g = bc.groupby("segment_id", as_index=False).agg(lat_c=("lat", "mean"), lon_c=("lon", "mean"))
    return g


def _nearest_segment_id(
    lat: float,
    lon: float,
    centroids: pd.DataFrame,
) -> tuple[str | None, float]:
    if centroids.empty or math.isnan(lat) or math.isnan(lon):
        return None, float("inf")
    best_id: str | None = None
    best_d = float("inf")
    for _, r in centroids.iterrows():
        d = _haversine_m(lat, lon, float(r["lat_c"]), float(r["lon_c"]))
        if d < best_d:
            best_d = d
            best_id = str(r["segment_id"]).strip()
    return best_id, best_d


def _nearest_parkingzone_on_segment(
    lat: float,
    lon: float,
    segment_id: str,
    bay_zones: pd.DataFrame,
    bays_clean: pd.DataFrame,
) -> tuple[str | None, str | None, float]:
    bz = bay_zones[
        bay_zones["segment_id"].astype(str).str.strip() == str(segment_id).strip()
    ].copy()
    if bz.empty:
        return None, None, float("inf")
    bc = bays_clean[["bay_id", "lat", "lon"]].copy()
    bc["bay_id"] = bc["bay_id"].astype(str).str.strip()
    m = bz.merge(bc, on="bay_id", how="inner")
    m = m[m["lat"].notna() & m["lon"].notna()]
    if m.empty:
        return None, None, float("inf")
    best_pz: str | None = None
    best_bid: str | None = None
    best_d = float("inf")
    for _, r in m.iterrows():
        d = _haversine_m(lat, lon, float(r["lat"]), float(r["lon"]))
        if d < best_d:
            best_d = d
            best_pz = str(r["parkingzone"]).strip()
            best_bid = str(r["bay_id"]).strip()
    return best_pz, best_bid, best_d


def _nearest_bay_zone_globally(
    lat: float,
    lon: float,
    bay_zones: pd.DataFrame,
    bays_clean: pd.DataFrame,
) -> tuple[str | None, str | None, str | None, float]:
    bc = bays_clean[["bay_id", "lat", "lon"]].copy()
    bc["bay_id"] = bc["bay_id"].astype(str).str.strip()
    bz = bay_zones.drop_duplicates(subset=["bay_id"])
    m = bz.merge(bc, on="bay_id", how="inner")
    m = m[m["lat"].notna() & m["lon"].notna()]
    if m.empty:
        return None, None, None, float("inf")
    best_pz, best_seg, best_bid, best_d = None, None, None, float("inf")
    for _, r in m.iterrows():
        d = _haversine_m(lat, lon, float(r["lat"]), float(r["lon"]))
        if d < best_d:
            best_d = d
            best_pz = str(r["parkingzone"]).strip()
            best_seg = str(r["segment_id"]).strip()
            best_bid = str(r["bay_id"]).strip()
    return best_pz, best_seg, best_bid, best_d


def recover_missing_rules(
    diag: pd.DataFrame,
    sensors_clean: pd.DataFrame,
    bays_clean: pd.DataFrame,
    combined_restrictions: pd.DataFrame,
    merged: pd.DataFrame,
    direct_bays: set[str],
    ctx: dict[str, Any] | None,
    cts: Any,
    verbose: bool = False,
) -> tuple[pd.DataFrame, pd.DataFrame, dict[str, Any], pd.DataFrame]:
    """
    Append safe recovery rows to combined_restrictions for categories A–C only.

    Returns
    -------
    combined_restrictions_new, merged_new, stats, recovery_restrictions_long
    """
    if ctx is None:
        log.warning("Missing-rule recovery skipped — no segment chain context")
        return (
            combined_restrictions,
            merged,
            {
                "skipped": True,
                "reason": "no ctx",
                "merged_row_count_post_recovery": len(merged),
            },
            _empty_recovery_restrictions_long(),
        )
    joined = ctx.get("joined")
    if joined is None or len(joined) == 0:
        log.warning("Missing-rule recovery skipped — no segment chain context")
        return (
            combined_restrictions,
            merged,
            {
                "skipped": True,
                "reason": "no ctx",
                "merged_row_count_post_recovery": len(merged),
            },
            _empty_recovery_restrictions_long(),
        )

    days_col = ctx["days_col"]
    start_col = ctx["start_col"]
    end_col = ctx["end_col"]
    has_time_data: bool = ctx["has_time_data"]
    code_map: dict = ctx["code_map"]
    signs: pd.DataFrame = ctx["signs"]
    zones: pd.DataFrame = ctx["zones"]
    bay_zones: pd.DataFrame = ctx["bay_zones"]

    valid_segments = set(zones["segment_id"].astype(str).str.strip())
    centroids = _segment_centroids(bays_clean, valid_segments)

    bays_with_td = set(
        combined_restrictions.loc[combined_restrictions["typedesc"].notna(), "bay_id"].astype(str)
    )
    missing_before = missing_bay_ids_from_merged(merged)

    recovery_frames: list[pd.DataFrame] = []
    stats = {
        "missing_before": len(missing_before),
        "recovered_bays": 0,
        "recovery_rows": 0,
        "attempted": {"C": 0, "A": 0, "B": 0},
        "skipped_threshold": {"C": 0, "A": 0, "B": 0},
        "skipped_direct_bay": 0,
        "skipped_c_cross_street": 0,
        "skipped_c_inconsistent_segment": 0,
        "skipped_a_borderline_inconsistent_segment": 0,
    }

    # Mutate caller's diagnostic frame in place (``run_phase`` passes a copy of classify output).
    for _c in (
        "recovery_method",
        "recovery_distance_m",
        "matched_segment_id",
        "ref_bay_id",
        "recovery_typedesc_slots",
        "notes",
    ):
        if _c in diag.columns:
            diag[_c] = diag[_c].astype(object)

    for i, r in diag.iterrows():
        cat = r["category"]
        bid = str(r["bay_id"]).strip()
        if bid in direct_bays:
            stats["skipped_direct_bay"] += 1
            continue
        if bid not in missing_before:
            continue
        if cat not in ("A", "B", "C"):
            if cat == "D":
                diag.at[i, "recovery_method"] = "none_manual_only"
            continue

        tlat, tlon = _sensor_lat_lon(sensors_clean, bid)
        if tlat is None:
            diag.at[i, "notes"] = (str(r.get("notes") or "") + "; no sensor lat/lon").strip("; ")
            continue

        ref_pz: str | None = None
        matched_seg: str | None = None
        ref_bay: str | None = None
        dist_eff = float("inf")
        method = ""

        if cat == "C":
            stats["attempted"]["C"] += 1
            rs_str = str(r.get("roadsegmentid") or "").strip()
            if centroids.empty:
                continue
            ms, dseg = _nearest_segment_id(tlat, tlon, centroids)
            if ms is None or dseg > MAX_SEGMENT_REMAP_M:
                stats["skipped_threshold"]["C"] += 1
                diag.at[i, "recovery_method"] = "nearest_segment_rejected"
                diag.at[i, "recovery_distance_m"] = (
                    str(round(dseg, 2)) if math.isfinite(dseg) else ""
                )
                continue
            pz, rb, dpz = _nearest_parkingzone_on_segment(tlat, tlon, ms, bay_zones, bays_clean)
            if pz is None or dpz > MAX_SEGMENT_REMAP_M:
                stats["skipped_threshold"]["C"] += 1
                diag.at[i, "recovery_method"] = "nearest_zone_on_segment_rejected"
                continue
            orig_street = _c_orig_street_text(bays_clean, bid, r.get("street"))
            if not _c_same_street(orig_street, ms, zones):
                stats["skipped_c_cross_street"] += 1
                diag.at[i, "recovery_method"] = "c_recovery_rejected_cross_street"
                diag.at[i, "recovery_distance_m"] = str(round(dseg, 2)) if math.isfinite(dseg) else ""
                diag.at[i, "matched_segment_id"] = ms or ""
                diag.at[i, "ref_bay_id"] = rb or ""
                continue
            if not _c_segment_merged_rules_consistent(merged, bays_clean, ms):
                stats["skipped_c_inconsistent_segment"] += 1
                diag.at[i, "recovery_method"] = "c_recovery_rejected_inconsistent_segment_rules"
                diag.at[i, "recovery_distance_m"] = str(round(dseg, 2)) if math.isfinite(dseg) else ""
                diag.at[i, "matched_segment_id"] = ms or ""
                diag.at[i, "ref_bay_id"] = rb or ""
                continue
            ref_pz, matched_seg, ref_bay = pz, ms, rb
            dist_eff = dseg
            method = f"nearest_segment_from_orphan_rs({rs_str}->{ms})"

        elif cat in ("A", "B"):
            stats["attempted"]["A" if cat == "A" else "B"] += 1
            pz, seg, rb, dref = _nearest_bay_zone_globally(tlat, tlon, bay_zones, bays_clean)
            key = "A" if cat == "A" else "B"
            eff_max = (
                A_BORDERLINE_MAX_M
                if cat == "A" and bid in A_BORDERLINE_50_60_BAY_IDS
                else MAX_NEAREST_BAY_REF_M
            )
            borderline_band = (
                cat == "A"
                and bid in A_BORDERLINE_50_60_BAY_IDS
                and pz is not None
                and math.isfinite(dref)
                and MAX_NEAREST_BAY_REF_M < dref <= A_BORDERLINE_MAX_M
            )
            if pz is None or dref > eff_max or not math.isfinite(dref):
                stats["skipped_threshold"][key] += 1
                diag.at[i, "recovery_method"] = "nearest_reference_bay_rejected"
                diag.at[i, "recovery_distance_m"] = (
                    str(round(dref, 2)) if math.isfinite(dref) else ""
                )
                continue
            if borderline_band:
                pz_s = str(pz).strip()
                sub_pre = signs[signs["parkingzone"].astype(str).str.strip() == pz_s]
                if sub_pre.empty:
                    diag.at[i, "recovery_method"] = "no_sign_plates_for_reference_parkingzone"
                    diag.at[i, "recovery_distance_m"] = str(round(dref, 2))
                    diag.at[i, "matched_segment_id"] = str(seg).strip() if seg else ""
                    diag.at[i, "ref_bay_id"] = str(rb).strip() if rb is not None else ""
                    continue
                seg_s = str(seg).strip() if seg else ""
                if not seg_s or not _c_segment_merged_rules_consistent(merged, bays_clean, seg_s):
                    stats["skipped_a_borderline_inconsistent_segment"] += 1
                    diag.at[i, "recovery_method"] = "a_recovery_rejected_borderline_inconsistent_segment"
                    diag.at[i, "recovery_distance_m"] = str(round(dref, 2))
                    diag.at[i, "matched_segment_id"] = seg_s
                    diag.at[i, "ref_bay_id"] = str(rb).strip() if rb is not None else ""
                    continue
            ref_pz, matched_seg, ref_bay = pz, seg, rb
            dist_eff = dref
            method = (
                "nearest_on_network_bay_parkingzone_borderline_60m"
                if borderline_band
                else "nearest_on_network_bay_parkingzone"
            )

        if not ref_pz:
            continue

        sub = signs[signs["parkingzone"].astype(str).str.strip() == ref_pz].copy()
        if sub.empty:
            diag.at[i, "recovery_method"] = "no_sign_plates_for_reference_parkingzone"
            diag.at[i, "recovery_distance_m"] = (
                str(round(dist_eff, 2)) if math.isfinite(dist_eff) else ""
            )
            diag.at[i, "matched_segment_id"] = str(matched_seg).strip() if matched_seg else ""
            diag.at[i, "ref_bay_id"] = str(ref_bay).strip() if ref_bay is not None else ""
            continue

        sj = sub.assign(bay_id=bid)
        rec_part = cts.restrictions_from_synthetic_joined(
            sj,
            days_col,
            start_col,
            end_col,
            has_time_data,
            code_map,
        )
        if rec_part.empty:
            diag.at[i, "recovery_method"] = "signs_were_all_lz_dp_skipped"
            diag.at[i, "notes"] = (
                str(r.get("notes") or "") + "; inherited zone has only LZ/DP plates"
            ).strip("; ")
            continue

        recovery_frames.append(rec_part)

        diag.at[i, "recovery_method"] = method
        diag.at[i, "recovery_distance_m"] = (
            str(round(dist_eff, 2)) if math.isfinite(dist_eff) else ""
        )
        diag.at[i, "matched_segment_id"] = matched_seg or ""
        diag.at[i, "ref_bay_id"] = ref_bay or ""
        diag.at[i, "recovery_typedesc_slots"] = str(int(rec_part["typedesc"].notna().sum()))

        if verbose:
            log.info("  Recovery %s bay %s via %s (≈%.1f m)", cat, bid, method, dist_eff)

    if not recovery_frames:
        merged_after = merged
        combined_new = combined_restrictions
        stats["recovered_bays"] = 0
        stats["recovery_rows"] = 0
        recovery_long = _empty_recovery_restrictions_long()
    else:
        rec_df = pd.concat(recovery_frames, ignore_index=True)
        # Never add duplicate rules for bays that already have typedesc
        rec_df = rec_df[~rec_df["bay_id"].astype(str).isin(bays_with_td)]
        if rec_df.empty:
            merged_after = merged
            combined_new = combined_restrictions
            stats["recovered_bays"] = 0
            stats["recovery_rows"] = 0
            recovery_long = _empty_recovery_restrictions_long()
        else:
            combined_new = pd.concat([combined_restrictions, rec_df], ignore_index=True)
            merged_after = cts.join_silver(sensors_clean, combined_new)
            stats["recovered_bays"] = int(rec_df["bay_id"].nunique())
            stats["recovery_rows"] = int(len(rec_df))
            recovery_long = _normalize_recovery_restrictions_long(rec_df)

    missing_after = missing_bay_ids_from_merged(merged_after)
    stats["missing_after"] = len(missing_after)
    stats["merged_row_count_post_recovery"] = len(merged_after)
    stats["by_category_after"] = {
        str(k): int(v)
        for k, v in diag[diag["bay_id"].astype(str).isin(missing_after)]
        .groupby("category")
        .size()
        .items()
    }
    return combined_new, merged_after, stats, recovery_long


def write_diagnostics_csv(diag: pd.DataFrame) -> Path:
    DIAGNOSTICS_DIR.mkdir(parents=True, exist_ok=True)
    path = DIAGNOSTICS_DIR / "missing_rule_bays.csv"
    out = diag.copy()

    review_flags: list[str] = []
    review_reasons: list[str] = []
    for _, row in out.iterrows():
        n = _recovery_slot_count(row.get("recovery_typedesc_slots"))
        if n <= 0:
            review_flags.append("")
            review_reasons.append("")
            continue
        dist = pd.to_numeric(row.get("recovery_distance_m"), errors="coerce")
        street = str(row.get("street") if row.get("street") is not None else "")
        rsn: list[str] = []
        if pd.notna(dist) and float(dist) > 60:
            rsn.append("distance_gt_60m")
        if "intersection" in street.lower():
            rsn.append("intersection_street")
        if rsn:
            review_flags.append("yes")
            review_reasons.append(";".join(rsn))
        else:
            review_flags.append("")
            review_reasons.append("")

    out["manual_review"] = review_flags
    out["manual_review_reason"] = review_reasons
    out["manual_review"] = out["manual_review"].fillna("").astype(str)
    out["manual_review_reason"] = out["manual_review_reason"].fillna("").astype(str)

    cols = [
        "bay_id",
        "category",
        "roadsegmentid",
        "parkingzone",
        "street",
        "notes",
        "recovery_method",
        "recovery_distance_m",
        "matched_segment_id",
        "ref_bay_id",
        "recovery_typedesc_slots",
        "manual_review",
        "manual_review_reason",
    ]
    for c in cols:
        if c not in out.columns:
            out[c] = ""
    out[cols].to_csv(path, index=False)
    log.info("Missing-rule diagnostics → %s", path)
    return path


def run_phase(
    sensors_clean: pd.DataFrame,
    bays_clean: pd.DataFrame,
    merged: pd.DataFrame,
    combined_restrictions: pd.DataFrame,
    direct_bays: set[str],
    ctx: dict[str, Any] | None,
    cts: Any,
    dry_run: bool,
    verbose: bool,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, dict[str, Any], pd.DataFrame]:
    """Classify, optionally recover, write CSV. Returns diag, combined, merged, stats, recovery_long."""
    diag = classify_missing_rule_bays(sensors_clean, bays_clean, merged, ctx)
    stats: dict[str, Any] = {
        "by_category_initial": {str(k): int(v) for k, v in diag.groupby("category").size().items()},
    }

    if ctx is None:
        write_diagnostics_csv(diag)
        stats["no_recovery"] = True
        stats["merged_row_count_post_recovery"] = len(merged)
        return diag, combined_restrictions, merged, stats, _empty_recovery_restrictions_long()

    diag_work = diag.copy()
    combined_new, merged_new, rec_stats, recovery_long = recover_missing_rules(
        diag_work,
        sensors_clean,
        bays_clean,
        combined_restrictions,
        merged,
        direct_bays,
        ctx,
        cts,
        verbose=verbose,
    )
    stats.update(rec_stats)
    combined_new, merged_new, strip_stats, recovery_long = apply_recovery_safety_strip(
        diag_work,
        combined_new,
        merged_new,
        sensors_clean,
        cts,
        rec_stats,
        verbose=verbose,
        recovery_long=recovery_long,
    )
    stats.update(strip_stats)
    write_diagnostics_csv(diag_work)

    log.info(
        "Missing-rule recovery: %d bays recovered, %d still missing typedesc",
        stats.get("recovered_bays", 0),
        stats.get("missing_after", 0),
    )
    if dry_run:
        stats["dry_run"] = True
        return diag_work, combined_new, merged_new, stats, recovery_long
    return diag_work, combined_new, merged_new, stats, recovery_long
