"""
spatial_overlap_check.py
========================
Diagnostic — Sensor-Only Bay ↔ Restriction Bay Spatial Overlap
FIT5120 TE31  MeloPark  Monash University

PURPOSE
-------
For every sensor-only bay (``has_restriction_data = false``), find the
nearest restriction bay (``has_restriction_data = true``) and report how
many fall within various distance thresholds.

This tells us how many sensor-only bays *could* potentially be matched to
a nearby restriction bay via spatial proximity — useful for deciding
whether a spatial-join enrichment step is worthwhile and what radius to use.

HOW TO RUN
----------
    cd melopark/
    python scripts/diagnostics/spatial_overlap_check.py

Requires DATABASE_URL in ``backend/.env`` (same as ``scripts/build_gold.py``).

OUTPUT
------
A summary table printed to stdout showing, for each distance threshold
(10 m, 20 m, 50 m, 100 m, 200 m), the number and percentage of
sensor-only bays that have at least one restriction bay within that radius.

DEPENDENCIES
------------
    pandas, scipy, sqlalchemy, python-dotenv, psycopg2-binary

NOTE
----
This script is **read-only** — it does not modify the database.
"""

import logging
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree

# ─── LOGGING ────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("spatial_overlap_check")

# ─── PATHS ──────────────────────────────────────────────────────────────────

ROOT = Path(__file__).resolve().parent.parent.parent
BACKEND_DIR = ROOT / "backend"

# Rough conversion at Melbourne's latitude (~-37.8°): 1° ≈ 99 000 m
DEG_TO_METRES = 99_000

THRESHOLDS_M = [10, 20, 50, 100, 200]


# ─── DATABASE HELPERS (mirrors build_gold.py) ───────────────────────────────

def _resolve_database_url(url: str) -> str:
    """Resolve relative sslrootcert paths against the backend directory."""
    from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

    parsed = urlparse(url)
    if not parsed.query:
        return url
    pairs: list[tuple[str, str]] = []
    changed = False
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if key == "sslrootcert" and value and not Path(value).is_absolute():
            cert_path = (BACKEND_DIR / value.lstrip("./\\")).resolve()
            pairs.append((key, cert_path.as_posix()))
            changed = True
        else:
            pairs.append((key, value))
    if not changed:
        return url
    new_query = urlencode(pairs)
    return urlunparse((
        parsed.scheme, parsed.netloc, parsed.path,
        parsed.params, new_query, parsed.fragment,
    ))


def _get_database_url() -> str:
    """Read DATABASE_URL from backend/.env."""
    from dotenv import load_dotenv

    env_path = BACKEND_DIR / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    url = os.environ.get("DATABASE_URL")
    if not url:
        log.error(
            "DATABASE_URL not set. "
            "Create backend/.env with DATABASE_URL=postgresql://... "
            "(see backend/.env.example)."
        )
        sys.exit(1)
    return _resolve_database_url(url)


# ─── MAIN ───────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("MeloPark — Spatial Overlap Diagnostic")
    log.info("=" * 55)

    # ── Connect & query ──────────────────────────────────────────────────
    from sqlalchemy import create_engine, text

    url = _get_database_url()
    engine = create_engine(url, pool_pre_ping=True)

    query = text(
        "SELECT bay_id, lat, lon, has_restriction_data "
        "FROM bays "
        "WHERE lat IS NOT NULL AND lon IS NOT NULL"
    )
    log.info("Querying bays table …")
    df = pd.read_sql(query, engine)
    log.info("Fetched %d bays with coordinates", len(df))

    # ── Split into two groups ────────────────────────────────────────────
    sensor_only = df[~df["has_restriction_data"]].reset_index(drop=True)
    restriction = df[df["has_restriction_data"]].reset_index(drop=True)

    n_sensor = len(sensor_only)
    n_restrict = len(restriction)

    log.info("Sensor-only bays:  %d", n_sensor)
    log.info("Restriction bays:  %d", n_restrict)

    if n_sensor == 0:
        log.warning("No sensor-only bays found — nothing to analyse.")
        return
    if n_restrict == 0:
        log.warning("No restriction bays found — cannot compute distances.")
        return

    # ── Build KD-tree on restriction bays (in degrees) ───────────────────
    restrict_coords = restriction[["lat", "lon"]].to_numpy()
    tree = cKDTree(restrict_coords)

    sensor_coords = sensor_only[["lat", "lon"]].to_numpy()
    distances_deg, _ = tree.query(sensor_coords, k=1)
    distances_m = distances_deg * DEG_TO_METRES

    # ── Print summary ────────────────────────────────────────────────────
    print()
    print(f"Sensor-only bays:  {n_sensor}")
    print(f"Restriction bays:  {n_restrict}")
    print()
    print("Spatial overlap analysis:")

    for threshold in THRESHOLDS_M:
        count = int(np.sum(distances_m <= threshold))
        pct = 100.0 * count / n_sensor
        print(f"  Within {threshold:>4d}m:   {count:>4d} bays ({pct:5.1f}%)")

    print()
    log.info("Done.")


if __name__ == "__main__":
    main()
