"""
build_gold_epic5.py - Silver -> Gold for Epic 5 (parking pressure map).

Reads:
    data/silver/sensors_clean.parquet          (zone_number, bay_id, lat, lon, status)
    data/silver/epic5_scats_sites_clean.parquet (site_no, lat, lon)
    data/silver/epic5_traffic_profile.parquet   (site_no, dow, hour, median_volume, p90_volume)
    data/silver/epic5_events_clean.parquet      (event_id, lat, lon, start_datetime, end_datetime, ...)
    data/bronze/epic5_event_sessions_raw.parquet (event_id, session_start, session_end)
    data/bronze/zones_to_segments.parquet       (parkingzone, onstreet, streetfrom, streetto)

Writes:
    data/gold/epic5_zone_bay_counts.parquet     zone metadata: bay count, centroid, label
    data/gold/epic5_zone_scats_map.parquet      zone -> nearest SCATS sites (k=3, IDW weights)
    data/gold/epic5_zone_hulls.geojson          zone boundary polygons (convex hull of bay points)
    data/gold/epic5_traffic_profile_zone.parquet zone x dow_type x hour -> traffic_z
    data/gold/epic5_build_metadata.json         build summary

Usage:
    python scripts/build_gold_epic5.py
    python scripts/build_gold_epic5.py --min-bays 5
"""

from __future__ import annotations

import argparse
import json
import logging
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("build_gold_epic5")

ROOT = Path(__file__).resolve().parent.parent
SILVER = ROOT / "data" / "silver"
BRONZE = ROOT / "data" / "bronze"
GOLD = ROOT / "data" / "gold"

K_NEAREST_SCATS = 3
MAX_SCATS_DIST_M = 500
MIN_BAYS_DEFAULT = 5


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ─────────────────────────────────────────────────────────────────────────────
# 1) Zone bay counts + centroids + labels
# ─────────────────────────────────────────────────────────────────────────────
def build_zone_bay_counts(min_bays: int) -> pd.DataFrame:
    sensors = pd.read_parquet(SILVER / "sensors_clean.parquet")
    sensors = sensors.dropna(subset=["zone_number", "lat", "lon"]).copy()
    sensors["zone_number"] = sensors["zone_number"].astype(int)

    grouped = sensors.groupby("zone_number").agg(
        total_bays=("bay_id", "count"),
        centroid_lat=("lat", "median"),
        centroid_lon=("lon", "median"),
        lat_min=("lat", "min"),
        lat_max=("lat", "max"),
        lon_min=("lon", "min"),
        lon_max=("lon", "max"),
    ).reset_index()

    # Zone label from zones_to_segments
    z2s = pd.read_parquet(BRONZE / "zones_to_segments.parquet")
    z2s = z2s.rename(columns={"parkingzone": "zone_number"})
    labels = (
        z2s.drop_duplicates(subset=["zone_number"])
        [["zone_number", "onstreet", "streetfrom", "streetto"]]
    )
    labels["zone_label"] = (
        labels["onstreet"].str.strip() + " (" +
        labels["streetfrom"].str.strip() + "–" +
        labels["streetto"].str.strip() + ")"
    )
    grouped = grouped.merge(
        labels[["zone_number", "zone_label"]],
        on="zone_number", how="left",
    )
    grouped["zone_label"] = grouped["zone_label"].fillna(
        "Zone " + grouped["zone_number"].astype(str)
    )

    # Filter small zones
    before = len(grouped)
    grouped = grouped[grouped["total_bays"] >= min_bays].copy()
    log.info("zone_bay_counts: %d zones (dropped %d with <%d bays)",
             len(grouped), before - len(grouped), min_bays)

    out = GOLD / "epic5_zone_bay_counts.parquet"
    grouped.to_parquet(out, index=False, engine="pyarrow")
    log.info("  -> %s", out.name)
    return grouped


# ─────────────────────────────────────────────────────────────────────────────
# 2) Zone ↔ SCATS site mapping (k-nearest, IDW)
# ─────────────────────────────────────────────────────────────────────────────
def build_zone_scats_map(zones: pd.DataFrame) -> pd.DataFrame:
    sites = pd.read_parquet(SILVER / "epic5_scats_sites_clean.parquet")
    rows: list[dict] = []

    for _, z in zones.iterrows():
        dists = []
        for _, s in sites.iterrows():
            d = haversine_m(z["centroid_lat"], z["centroid_lon"],
                            s["lat"], s["lon"])
            if d <= MAX_SCATS_DIST_M:
                dists.append((s["site_no"], d))
        dists.sort(key=lambda x: x[1])
        nearest = dists[:K_NEAREST_SCATS]
        if not nearest:
            continue
        total_inv = sum(1.0 / max(d, 1.0) for _, d in nearest)
        for site_no, d in nearest:
            w = (1.0 / max(d, 1.0)) / total_inv
            rows.append({
                "zone_number": z["zone_number"],
                "site_no": int(site_no),
                "distance_m": round(d, 1),
                "weight": round(w, 4),
            })

    df = pd.DataFrame(rows)
    zones_with_scats = df["zone_number"].nunique() if len(df) else 0
    log.info("zone_scats_map: %d mappings, %d/%d zones have SCATS within %dm",
             len(df), zones_with_scats, len(zones), MAX_SCATS_DIST_M)

    out = GOLD / "epic5_zone_scats_map.parquet"
    df.to_parquet(out, index=False, engine="pyarrow")
    log.info("  -> %s", out.name)
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 3) Zone hulls (GeoJSON)
# ─────────────────────────────────────────────────────────────────────────────
def build_zone_hulls(zones: pd.DataFrame) -> dict:
    sensors = pd.read_parquet(SILVER / "sensors_clean.parquet")
    sensors = sensors.dropna(subset=["zone_number", "lat", "lon"]).copy()
    sensors["zone_number"] = sensors["zone_number"].astype(int)
    valid_zones = set(zones["zone_number"].tolist())
    sensors = sensors[sensors["zone_number"].isin(valid_zones)]

    features: list[dict] = []

    for zone_id, grp in sensors.groupby("zone_number"):
        coords = list(zip(grp["lon"].tolist(), grp["lat"].tolist()))
        if len(coords) < 3:
            # Line or point — create small buffer rectangle
            lat_c = grp["lat"].median()
            lon_c = grp["lon"].median()
            buf = 0.0005  # ~50m
            polygon = [[
                [lon_c - buf, lat_c - buf],
                [lon_c + buf, lat_c - buf],
                [lon_c + buf, lat_c + buf],
                [lon_c - buf, lat_c + buf],
                [lon_c - buf, lat_c - buf],
            ]]
        else:
            from scipy.spatial import ConvexHull
            points = np.array(coords)
            try:
                hull = ConvexHull(points)
                hull_coords = [points[i].tolist() for i in hull.vertices]
                hull_coords.append(hull_coords[0])  # close ring
                polygon = [hull_coords]
            except Exception:
                lat_c = grp["lat"].median()
                lon_c = grp["lon"].median()
                buf = 0.0005
                polygon = [[
                    [lon_c - buf, lat_c - buf],
                    [lon_c + buf, lat_c - buf],
                    [lon_c + buf, lat_c + buf],
                    [lon_c - buf, lat_c + buf],
                    [lon_c - buf, lat_c - buf],
                ]]

        zone_meta = zones[zones["zone_number"] == zone_id].iloc[0]
        features.append({
            "type": "Feature",
            "properties": {
                "zone_number": int(zone_id),
                "zone_label": zone_meta.get("zone_label", f"Zone {zone_id}"),
                "total_bays": int(zone_meta["total_bays"]),
                "centroid_lat": float(zone_meta["centroid_lat"]),
                "centroid_lon": float(zone_meta["centroid_lon"]),
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": polygon,
            },
        })

    geojson = {
        "type": "FeatureCollection",
        "features": features,
    }

    out = GOLD / "epic5_zone_hulls.geojson"
    with open(out, "w") as f:
        json.dump(geojson, f)
    log.info("zone_hulls: %d polygons -> %s", len(features), out.name)
    return geojson


# ─────────────────────────────────────────────────────────────────────────────
# 4) Traffic profile by zone (weekday/weekend × hour)
# ─────────────────────────────────────────────────────────────────────────────
def build_traffic_profile_zone(zones: pd.DataFrame, zone_scats: pd.DataFrame) -> pd.DataFrame:
    profile = pd.read_parquet(SILVER / "epic5_traffic_profile.parquet")

    # Classify dow → dow_type: weekday (0-4) vs weekend (5-6)
    profile["dow_type"] = np.where(profile["dow"] < 5, "weekday", "weekend")

    # Aggregate to site × dow_type × hour (pool Mon-Fri, pool Sat-Sun)
    site_profile = (
        profile.groupby(["site_no", "dow_type", "hour"], as_index=False)
        .agg(median_volume=("median_volume", "median"),
             p90_volume=("p90_volume", "median"))
    )

    # Compute z-score within each site's own distribution
    site_stats = (
        site_profile.groupby("site_no")["median_volume"]
        .agg(site_mean="mean", site_std="std")
        .reset_index()
    )
    site_stats["site_std"] = site_stats["site_std"].replace(0, 1)
    site_profile = site_profile.merge(site_stats, on="site_no")
    site_profile["traffic_z"] = (
        (site_profile["median_volume"] - site_profile["site_mean"]) /
        site_profile["site_std"]
    )

    # Blend into zone-level via IDW weights from zone_scats_map
    rows: list[dict] = []
    for _, z in zones.iterrows():
        zn = z["zone_number"]
        mappings = zone_scats[zone_scats["zone_number"] == zn]
        if mappings.empty:
            # No SCATS — fill with neutral (z=0)
            for dow_type in ["weekday", "weekend"]:
                for hour in range(24):
                    rows.append({
                        "zone_number": zn,
                        "dow_type": dow_type,
                        "hour": hour,
                        "traffic_z": 0.0,
                        "median_volume_blended": 0.0,
                    })
            continue

        for dow_type in ["weekday", "weekend"]:
            for hour in range(24):
                weighted_z = 0.0
                weighted_vol = 0.0
                total_w = 0.0
                for _, m in mappings.iterrows():
                    sp = site_profile[
                        (site_profile["site_no"] == m["site_no"]) &
                        (site_profile["dow_type"] == dow_type) &
                        (site_profile["hour"] == hour)
                    ]
                    if sp.empty:
                        continue
                    w = m["weight"]
                    weighted_z += sp.iloc[0]["traffic_z"] * w
                    weighted_vol += sp.iloc[0]["median_volume"] * w
                    total_w += w
                if total_w > 0:
                    weighted_z /= total_w
                    weighted_vol /= total_w
                rows.append({
                    "zone_number": zn,
                    "dow_type": dow_type,
                    "hour": hour,
                    "traffic_z": round(weighted_z, 4),
                    "median_volume_blended": round(weighted_vol, 1),
                })

    df = pd.DataFrame(rows)
    out = GOLD / "epic5_traffic_profile_zone.parquet"
    df.to_parquet(out, index=False, engine="pyarrow")
    log.info("traffic_profile_zone: %d rows -> %s", len(df), out.name)
    return df


# ─────────────────────────────────────────────────────────────────────────────
# 5) Event sessions cleaned + joined for temporal lookup
# ─────────────────────────────────────────────────────────────────────────────
def build_event_sessions_gold() -> pd.DataFrame:
    events = pd.read_parquet(SILVER / "epic5_events_clean.parquet")
    sessions_path = BRONZE / "epic5_event_sessions_raw.parquet"

    if not sessions_path.exists() or events.empty:
        log.warning("No event sessions — writing empty gold.")
        df = pd.DataFrame(columns=[
            "event_id", "event_name", "lat", "lon",
            "session_start", "session_end", "category_name",
        ])
        out = GOLD / "epic5_event_sessions_gold.parquet"
        df.to_parquet(out, index=False, engine="pyarrow")
        return df

    sessions = pd.read_parquet(sessions_path)
    sessions["session_start"] = pd.to_datetime(sessions["session_start"], errors="coerce")
    sessions["session_end"] = pd.to_datetime(sessions["session_end"], errors="coerce")
    sessions = sessions.dropna(subset=["session_start"])

    # Join event metadata (lat, lon, name, category)
    event_cols = ["event_id", "event_name", "lat", "lon", "category_name", "venue_name"]
    available_cols = [c for c in event_cols if c in events.columns]
    joined = sessions.merge(events[available_cols], on="event_id", how="inner")

    out = GOLD / "epic5_event_sessions_gold.parquet"
    joined.to_parquet(out, index=False, engine="pyarrow")
    log.info("event_sessions_gold: %d rows -> %s", len(joined), out.name)
    return joined


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
def main(min_bays: int) -> None:
    GOLD.mkdir(parents=True, exist_ok=True)
    started = datetime.now(timezone.utc)
    log.info("Epic 5 gold build starting at %s", started.isoformat())

    # Step 1: zone bay counts
    zones = build_zone_bay_counts(min_bays)

    # Step 2: zone ↔ SCATS mapping
    zone_scats = build_zone_scats_map(zones)

    # Step 3: zone hulls GeoJSON
    build_zone_hulls(zones)

    # Step 4: traffic profile by zone
    build_traffic_profile_zone(zones, zone_scats)

    # Step 5: event sessions gold
    build_event_sessions_gold()

    # Metadata
    meta = {
        "pipeline_stage": "gold",
        "epic": "epic5",
        "feature": "parking_pressure_map",
        "built_at": started.isoformat(),
        "params": {
            "min_bays": min_bays,
            "k_nearest_scats": K_NEAREST_SCATS,
            "max_scats_dist_m": MAX_SCATS_DIST_M,
        },
        "outputs": [
            "epic5_zone_bay_counts.parquet",
            "epic5_zone_scats_map.parquet",
            "epic5_zone_hulls.geojson",
            "epic5_traffic_profile_zone.parquet",
            "epic5_event_sessions_gold.parquet",
        ],
        "zones_count": int(len(zones)),
        "zones_with_scats": int(zone_scats["zone_number"].nunique()) if len(zone_scats) else 0,
    }
    meta_path = GOLD / "epic5_build_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    log.info("Gold metadata -> %s", meta_path.name)
    log.info("Epic 5 gold build complete.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Epic 5 gold outputs.")
    parser.add_argument("--min-bays", type=int, default=MIN_BAYS_DEFAULT,
                        help="Minimum bays per zone to include (default 5).")
    args = parser.parse_args()
    main(min_bays=args.min_bays)
