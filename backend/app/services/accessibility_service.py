"""Epic 4 accessibility data service."""

from __future__ import annotations

import logging
import math
import time
from datetime import datetime as dt_datetime
from functools import lru_cache
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)


def _all_step(phase: str, t0: float, t_prev: float, *, top_n: int, available_only: bool) -> float:
    """Lightweight timing for /api/accessibility/all (no row data, only query params)."""
    now = time.perf_counter()
    logger.info(
        "accessibility_all phase=%s delta_ms=%.1f total_ms=%.1f top_n=%s available_only=%s",
        phase,
        (now - t_prev) * 1000.0,
        (now - t0) * 1000.0,
        top_n,
        available_only,
    )
    return now

ROOT = Path(__file__).resolve().parent.parent.parent.parent
GOLD_ACCESSIBILITY_PATH = ROOT / "data" / "gold" / "gold_accessibility_bays.parquet"
SILVER_ACCESSIBILITY_POINTS_PATH = ROOT / "data" / "silver" / "disability_parking_points_unified_clean.parquet"
SILVER_ACCESSIBILITY_POINTS_CSV_PATH = ROOT / "data" / "silver" / "disability_parking_points_clean.parquet"


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distance in meters between two WGS84 points."""
    r = 6_371_000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lam = math.radians(lon2 - lon1)
    a = math.sin(d_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lam / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


@lru_cache(maxsize=1)
def load_accessibility_gold() -> pd.DataFrame:
    """Load and cache Epic 4 accessibility gold output."""
    if not GOLD_ACCESSIBILITY_PATH.exists():
        raise FileNotFoundError(
            f"Missing accessibility gold file: {GOLD_ACCESSIBILITY_PATH}. "
            "Run scripts/build_gold.py first."
        )
    df = pd.read_parquet(GOLD_ACCESSIBILITY_PATH)
    if "is_disability_only" in df.columns:
        df["is_disability_only"] = df["is_disability_only"].fillna(False).astype(bool)
    if "has_disability_extension" in df.columns:
        df["has_disability_extension"] = df["has_disability_extension"].fillna(False).astype(bool)
    if "is_available_now" in df.columns:
        df["is_available_now"] = df["is_available_now"].fillna(False).astype(bool)
    else:
        df["is_available_now"] = df["status"].astype(str).str.upper().eq("ABSENT")
    df["lat"] = pd.to_numeric(df.get("lat"), errors="coerce")
    df["lon"] = pd.to_numeric(df.get("lon"), errors="coerce")
    return df


@lru_cache(maxsize=1)
def load_accessibility_points() -> pd.DataFrame:
    """Load and cache raw accessibility points (CSV + ArcGIS unified)."""
    points_path = SILVER_ACCESSIBILITY_POINTS_PATH
    if not points_path.exists():
        points_path = SILVER_ACCESSIBILITY_POINTS_CSV_PATH
    if not points_path.exists():
        raise FileNotFoundError(
            f"Missing accessibility points file: {SILVER_ACCESSIBILITY_POINTS_PATH} "
            f"(fallback: {SILVER_ACCESSIBILITY_POINTS_CSV_PATH}). "
            "Run scripts/clean_to_silver.py first."
        )

    df = pd.read_parquet(points_path).copy()
    df["lat"] = pd.to_numeric(df.get("lat"), errors="coerce")
    df["lng"] = pd.to_numeric(df.get("lng"), errors="coerce")
    df = df[df["lat"].notna() & df["lng"].notna()].copy()
    if "source" not in df.columns:
        df["source"] = "unknown"
    if "name" not in df.columns:
        df["name"] = None
    return df


def get_accessibility_points(top_n: int = 5000) -> dict:
    """Return raw accessibility points for map overlay mode."""
    df = load_accessibility_points().copy()
    df = df.drop_duplicates(subset=["lat", "lng", "source"], keep="first")
    if top_n > 0:
        df = df.head(top_n)

    out = df[["name", "lat", "lng", "source"]].copy().astype(object)
    out = out.where(pd.notna(out), None)
    points = out.to_dict(orient="records")
    return {
        "total_points": len(points),
        "points": points,
    }


def _lastupdated_scalar_to_iso(v: object) -> str | None:
    """Format a single lastupdated cell (fallback when vectorized parse fails)."""
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, pd.Timestamp):
        if v.tzinfo:
            return v.tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%S%z")
        return v.tz_localize("UTC").strftime("%Y-%m-%dT%H:%M:%S%z")
    if isinstance(v, dt_datetime):
        ts = pd.Timestamp(v)
        if ts.tzinfo:
            return ts.tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%S%z")
        return ts.tz_localize("UTC").strftime("%Y-%m-%dT%H:%M:%S%z")
    return str(v)


def _vectorize_lastupdated_column(series: pd.Series) -> pd.Series:
    """Vector parse to ISO strings; rare unparsed non-null values use scalar fallback."""
    dt = pd.to_datetime(series, errors="coerce", utc=True)
    result = pd.Series(index=series.index, dtype=object)
    mask_ok = dt.notna()
    if mask_ok.any():
        formatted = dt.loc[mask_ok].dt.tz_convert("UTC").dt.strftime("%Y-%m-%dT%H:%M:%S%z")
        result.loc[mask_ok] = formatted
    mask_fb = (~mask_ok) & series.notna()
    if mask_fb.any():
        for idx in series.index[mask_fb]:
            result.loc[idx] = _lastupdated_scalar_to_iso(series.loc[idx])
    return result


# Columns needed for /api/accessibility/all after row filter (avoid carrying wide parquet rows).
_ALL_BAYS_PIPELINE_COLS: tuple[str, ...] = (
    "bay_id",
    "lat",
    "lon",
    "is_active_now",
    "is_available_now",
    "status",
    "typedesc",
    "plain_english",
    "duration_mins",
    "disabilityext_mins",
    "starttime",
    "endtime",
    "fromday",
    "today",
    "has_disability_extension",
    "disability_match_confidence",
    "lastupdated",
)


def _dedupe_best_row_per_bay_id(df: pd.DataFrame) -> pd.DataFrame:
    """Pick one row per bay_id, matching prior lex sort (active desc, then available desc)."""
    if df.empty:
        return df
    has_active = "is_active_now" in df.columns
    has_avail = "is_available_now" in df.columns
    if has_active and has_avail:
        a = df["is_active_now"].fillna(False).astype(bool).astype(int)
        b = df["is_available_now"].fillna(False).astype(bool).astype(int)
        score = a * 2 + b
    elif has_active:
        score = df["is_active_now"].fillna(False).astype(bool).astype(int)
    elif has_avail:
        score = df["is_available_now"].fillna(False).astype(bool).astype(int)
    else:
        score = pd.Series(0, index=df.index, dtype=int)

    tmp = df.assign(_dedupe_score=score)
    idx = tmp.groupby("bay_id", sort=False)["_dedupe_score"].idxmax()
    out = tmp.loc[idx].drop(columns=["_dedupe_score"]).reset_index(drop=True)
    return out


def _normalize_accessibility_rows_for_response(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize nullable and datetime fields to response-friendly types."""
    out = df.copy()

    if "lastupdated" in out.columns:
        out["lastupdated"] = _vectorize_lastupdated_column(out["lastupdated"])

    for nullable_str_col in ("typedesc", "plain_english", "starttime", "endtime"):
        if nullable_str_col in out.columns:
            out[nullable_str_col] = out[nullable_str_col].where(out[nullable_str_col].notna(), None)

    if "status" in out.columns:
        out["status"] = out["status"].where(out["status"].notna(), "Unknown").astype(str)

    return out


@lru_cache(maxsize=64)
def _get_all_disability_bays_cached(top_n: int, available_only: bool) -> dict:
    """Build /api/accessibility/all payload; cached per (top_n, available_only).

    Gold parquet is static for the process lifetime; repeated requests must not
    re-scan and normalize the full frame (avoids gateway timeouts).
    """
    t0 = time.perf_counter()
    tp = t0

    base = load_accessibility_gold()
    tp = _all_step("load_accessibility_gold", t0, tp, top_n=top_n, available_only=available_only)

    mask = base["is_disability_only"] & base["lat"].notna() & base["lon"].notna()
    tp = _all_step("disability_filtering", t0, tp, top_n=top_n, available_only=available_only)

    use_cols = [c for c in _ALL_BAYS_PIPELINE_COLS if c in base.columns]
    if "bay_id" not in use_cols and "bay_id" in base.columns:
        use_cols = ["bay_id", *[c for c in use_cols if c != "bay_id"]]
    tp = _all_step("column_selection", t0, tp, top_n=top_n, available_only=available_only)

    df = base.loc[mask, use_cols].copy() if use_cols else base.loc[mask].copy()
    tp = _all_step("slice_and_copy", t0, tp, top_n=top_n, available_only=available_only)

    if available_only:
        df = df[df["is_available_now"]].copy()
        tp = _all_step("available_only_filter", t0, tp, top_n=top_n, available_only=available_only)

    if df.empty:
        _all_step("empty_result", t0, tp, top_n=top_n, available_only=available_only)
        return {
            "total_candidates": 0,
            "returned": 0,
            "bays": [],
        }

    df = _dedupe_best_row_per_bay_id(df)
    tp = _all_step("dedupe", t0, tp, top_n=top_n, available_only=available_only)

    total_candidates = len(df)
    if top_n > 0:
        df = df.head(top_n)
    tp = _all_step("head_top_n", t0, tp, top_n=top_n, available_only=available_only)

    df = _normalize_accessibility_rows_for_response(df)
    tp = _all_step("normalization", t0, tp, top_n=top_n, available_only=available_only)

    cols = [
        "bay_id", "lat", "lon", "status", "is_available_now",
        "typedesc", "plain_english", "duration_mins", "disabilityext_mins",
        "starttime", "endtime", "fromday", "today",
        "has_disability_extension", "disability_match_confidence", "lastupdated",
    ]
    cols = [c for c in cols if c in df.columns]
    out_df = df[cols].copy().astype(object)
    out_df = out_df.where(pd.notna(out_df), None)
    bays = out_df.to_dict(orient="records")
    _all_step("response_build", t0, tp, top_n=top_n, available_only=available_only)

    return {
        "total_candidates": total_candidates,
        "returned": len(bays),
        "bays": bays,
    }


def get_all_disability_bays(top_n: int = 5000, available_only: bool = False) -> dict:
    """Return all accessibility-matched bays (not destination-radius limited)."""
    return _get_all_disability_bays_cached(top_n, available_only)


def find_nearby_disability_bays(
    dest_lat: float,
    dest_lon: float,
    radius_m: int = 500,
    top_n: int = 20,
    available_only: bool = False,
) -> dict:
    """Return nearby disability bays ranked by availability then distance."""
    df = load_accessibility_gold().copy()

    # Keep disability-only bays with valid coordinates.
    df = df[
        df["is_disability_only"]
        & df["lat"].notna()
        & df["lon"].notna()
    ].copy()

    if available_only:
        df = df[df["is_available_now"]].copy()

    if df.empty:
        return {
            "destination_lat": dest_lat,
            "destination_lon": dest_lon,
            "radius_m": radius_m,
            "total_candidates": 0,
            "returned": 0,
            "bays": [],
        }

    df["distance_m"] = df.apply(
        lambda r: _haversine_m(dest_lat, dest_lon, float(r["lat"]), float(r["lon"])),
        axis=1,
    )

    df = df[df["distance_m"] <= float(radius_m)].copy()
    if df.empty:
        return {
            "destination_lat": dest_lat,
            "destination_lon": dest_lon,
            "radius_m": radius_m,
            "total_candidates": 0,
            "returned": 0,
            "bays": [],
        }

    # Prefer available bays, then closest distance, then keep one best row per bay.
    df = df.sort_values(["is_available_now", "distance_m"], ascending=[False, True])
    df = df.drop_duplicates(subset=["bay_id"], keep="first")
    total_candidates = len(df)
    df = df.head(top_n)

    df = _normalize_accessibility_rows_for_response(df)

    cols = [
        "bay_id", "lat", "lon", "distance_m", "status", "is_available_now",
        "typedesc", "plain_english", "duration_mins", "disabilityext_mins",
        "starttime", "endtime", "fromday", "today",
        "has_disability_extension", "lastupdated",
    ]
    cols = [c for c in cols if c in df.columns]
    out_df = df[cols].copy().astype(object)
    out_df = out_df.where(pd.notna(out_df), None)
    bays = out_df.to_dict(orient="records")

    return {
        "destination_lat": dest_lat,
        "destination_lon": dest_lon,
        "radius_m": radius_m,
        "total_candidates": total_candidates,
        "returned": len(bays),
        "bays": bays,
    }

