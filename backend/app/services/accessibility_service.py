"""Epic 4 accessibility data service."""

from __future__ import annotations

import math
from functools import lru_cache
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent.parent.parent
GOLD_ACCESSIBILITY_PATH = ROOT / "data" / "gold" / "gold_accessibility_bays.parquet"


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
    total_candidates = len(df)
    if total_candidates == 0:
        return {
            "destination_lat": dest_lat,
            "destination_lon": dest_lon,
            "radius_m": radius_m,
            "total_candidates": 0,
            "returned": 0,
            "bays": [],
        }

    # Prefer available bays, then closest distance.
    df = df.sort_values(["is_available_now", "distance_m"], ascending=[False, True])
    df = df.head(top_n)

    cols = [
        "bay_id", "lat", "lon", "distance_m", "status", "is_available_now",
        "typedesc", "plain_english", "duration_mins", "disabilityext_mins",
        "starttime", "endtime", "fromday", "today",
        "has_disability_extension", "lastupdated",
    ]
    cols = [c for c in cols if c in df.columns]
    bays = df[cols].to_dict(orient="records")

    return {
        "destination_lat": dest_lat,
        "destination_lon": dest_lon,
        "radius_m": radius_m,
        "total_candidates": total_candidates,
        "returned": len(bays),
        "bays": bays,
    }

