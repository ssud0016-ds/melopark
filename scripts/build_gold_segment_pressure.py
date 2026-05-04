"""Build gold segment-pressure static parquet.

Joins CoM road-corridors geometry with:
- sensor_to_segment_lookup (for total_bays per segment)
- zones_to_segments (for zone_numbers list, drives traffic blend)
- epic5_scats_sites_clean (for nearest SCATS sites within 200 m)

Output: data/gold/epic5_segment_pressure_static.parquet
Columns:
  segment_id (str), street_name (str), seg_descr (str),
  geometry_wkb (bytes), bbox (list[float, 4]),
  total_bays (int), zone_numbers (list[int]),
  scats_site_no (list[int]), scats_weights (list[float])

Centerline approximated as long-axis midline of minimum rotated rectangle.

Source: CoM open data (CC BY 4.0).
"""

from __future__ import annotations

import json
import math
from pathlib import Path

import pandas as pd
from shapely.geometry import LineString, mapping, shape
from shapely.ops import unary_union
from shapely.wkb import dumps as wkb_dumps

ROOT = Path(__file__).resolve().parent.parent
BRONZE = ROOT / "data" / "bronze"
SILVER = ROOT / "data" / "silver"
GOLD = ROOT / "data" / "gold"
DATA = ROOT / "data"


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6_371_000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def centerline_from_polygon(poly):
    """Approximate centerline as long-axis midline of minimum rotated rectangle."""
    if poly.geom_type == "MultiPolygon":
        merged = unary_union(poly)
        if merged.geom_type == "MultiPolygon":
            poly = max(merged.geoms, key=lambda p: p.area)
        else:
            poly = merged

    mrr = poly.minimum_rotated_rectangle
    coords = list(mrr.exterior.coords)[:4]
    edges = [(coords[i], coords[(i + 1) % 4]) for i in range(4)]
    lengths = [LineString(e).length for e in edges]
    sorted_idx = sorted(range(4), key=lambda i: lengths[i])
    short1, short2 = edges[sorted_idx[0]], edges[sorted_idx[1]]
    mid1 = ((short1[0][0] + short1[1][0]) / 2, (short1[0][1] + short1[1][1]) / 2)
    mid2 = ((short2[0][0] + short2[1][0]) / 2, (short2[0][1] + short2[1][1]) / 2)
    return LineString([mid1, mid2])


def parse_seg_descr(descr: str) -> tuple[str, str | None, str | None]:
    """Parse 'Rosslyn Street between Howard Street and King Street' → (street, from, to)."""
    if not descr:
        return ("", None, None)
    if " between " in descr:
        street, rest = descr.split(" between ", 1)
        if " and " in rest:
            sfrom, sto = rest.split(" and ", 1)
            return (street.strip(), sfrom.strip(), sto.strip())
        return (street.strip(), rest.strip(), None)
    return (descr.strip(), None, None)


def main():
    print("Loading road-corridors geojson…")
    with open(BRONZE / "road_segments.geojson") as f:
        rc = json.load(f)
    print(f"  {len(rc['features'])} features")

    print("Loading sensor→segment lookup…")
    lookup = pd.read_csv(DATA / "sensor_to_segment_lookup.csv")
    bays_per_seg = lookup.groupby("roadsegmentid").size().to_dict()
    print(f"  {len(bays_per_seg)} segments carry sensors")

    print("Loading zones→segments…")
    z2s = pd.read_parquet(BRONZE / "zones_to_segments.parquet")
    seg_to_zones: dict[str, list[int]] = {}
    for _, row in z2s.iterrows():
        sid = str(row["segment_id"])
        seg_to_zones.setdefault(sid, []).append(int(row["parkingzone"]))

    print("Loading SCATS sites…")
    scats = pd.read_parquet(SILVER / "epic5_scats_sites_clean.parquet")
    print(f"  {len(scats)} SCATS sites; cols={list(scats.columns)}")

    # Detect lat/lon columns
    lat_col = next((c for c in scats.columns if c.lower() in ("lat", "latitude", "y")), None)
    lon_col = next((c for c in scats.columns if c.lower() in ("lon", "lng", "longitude", "x")), None)
    site_col = next((c for c in scats.columns if "site" in c.lower()), "site_no")
    if not (lat_col and lon_col):
        raise RuntimeError(f"Could not detect SCATS lat/lon columns: {list(scats.columns)}")
    scats_pts = scats[[site_col, lat_col, lon_col]].dropna()

    rows: list[dict] = []
    skipped = 0
    for f in rc["features"]:
        props = f["properties"]
        seg_id = str(props.get("seg_id", "")).strip()
        if not seg_id:
            continue
        try:
            poly = shape(f["geometry"])
            line = centerline_from_polygon(poly)
        except Exception:
            skipped += 1
            continue

        coords = list(line.coords)
        if len(coords) < 2:
            skipped += 1
            continue
        mid_lat = (coords[0][1] + coords[-1][1]) / 2
        mid_lon = (coords[0][0] + coords[-1][0]) / 2

        # SCATS within 200 m of midpoint, take up to 3 nearest
        dists = []
        for _, sp in scats_pts.iterrows():
            d = _haversine_m(mid_lat, mid_lon, sp[lat_col], sp[lon_col])
            if d <= 200:
                dists.append((int(sp[site_col]), d))
        dists.sort(key=lambda x: x[1])
        dists = dists[:3]
        if dists:
            inv = [1.0 / max(d, 1.0) for _, d in dists]
            wsum = sum(inv)
            scats_sites = [s for s, _ in dists]
            scats_weights = [round(w / wsum, 4) for w in inv]
        else:
            scats_sites = []
            scats_weights = []

        street, sfrom, sto = parse_seg_descr(props.get("seg_descr", ""))

        rows.append({
            "segment_id": seg_id,
            "street_name": street,
            "from_street": sfrom,
            "to_street": sto,
            "seg_descr": props.get("seg_descr", ""),
            "geometry_wkb": wkb_dumps(line),
            "bbox_minlon": line.bounds[0],
            "bbox_minlat": line.bounds[1],
            "bbox_maxlon": line.bounds[2],
            "bbox_maxlat": line.bounds[3],
            "mid_lat": mid_lat,
            "mid_lon": mid_lon,
            "total_bays": int(bays_per_seg.get(int(seg_id), 0)) if seg_id.isdigit() else 0,
            "zone_numbers": seg_to_zones.get(seg_id, []),
            "scats_site_no": scats_sites,
            "scats_weights": scats_weights,
        })

    print(f"  built {len(rows)} segments, skipped {skipped}")
    df = pd.DataFrame(rows)
    out = GOLD / "epic5_segment_pressure_static.parquet"
    df.to_parquet(out, index=False)
    print(f"Wrote {out} ({out.stat().st_size // 1024} KB)")
    print(f"  segments with bays: {(df.total_bays > 0).sum()}")
    print(f"  segments with SCATS: {(df.scats_site_no.str.len() > 0).sum()}")
    print(f"  segments with zones: {(df.zone_numbers.str.len() > 0).sum()}")


if __name__ == "__main__":
    main()
