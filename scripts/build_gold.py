"""
build_gold.py - Loads the Gold PostgreSQL (Supabase) database from Silver CSVs.

Usage:
    python scripts/build_gold.py

Reads from data/silver/, writes to Postgres tables via DATABASE_URL.
Drops and recreates all tables on each run (via if_exists='replace').
"""

import os
import sys

import pandas as pd
from sqlalchemy import text


SILVER_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "silver")


def _backend_import_path() -> str:
    # Ensure backend package imports work when running from /scripts.
    return os.path.join(os.path.dirname(__file__), "..", "backend")


def build():
    backend_dir = _backend_import_path()
    if backend_dir not in sys.path:
        sys.path.insert(0, backend_dir)

    from app.core.db import engine  # noqa: E402

    print("Building Gold database in Postgres...\n")

    # Load and insert bays
    bays_path = os.path.join(SILVER_DIR, "bays.csv")
    if os.path.exists(bays_path):
        print("Loading bays...")
        bays = pd.read_csv(bays_path)
        bays.to_sql("bays", engine, if_exists="replace", index=False)
        print(f"  Inserted {len(bays)} bays")

        # Create index on marker_id for fast joins
        with engine.begin() as conn:
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_bays_marker ON bays(marker_id)")
    else:
        print("  WARNING: bays.csv not found in silver/")

    # Load and insert normalised restrictions
    rest_path = os.path.join(SILVER_DIR, "restrictions_normalised.csv")
    if os.path.exists(rest_path):
        print("Loading restrictions...")
        restrictions = pd.read_csv(rest_path)
        restrictions.to_sql("restrictions", engine, if_exists="replace", index=False)
        print(f"  Inserted {len(restrictions)} restriction windows")

        # Index on bay_id for the restriction translator
        with engine.begin() as conn:
            conn.exec_driver_sql("CREATE INDEX IF NOT EXISTS idx_rest_bay ON restrictions(bay_id)")
    else:
        print("  WARNING: restrictions_normalised.csv not found in silver/")

    # Load and insert meters
    meters_path = os.path.join(SILVER_DIR, "meters.csv")
    if os.path.exists(meters_path):
        print("Loading meters...")
        meters = pd.read_csv(meters_path)
        meters.to_sql("meters", engine, if_exists="replace", index=False)
        print(f"  Inserted {len(meters)} meters")
    else:
        print("  WARNING: meters.csv not found in silver/")

    # Print summary
    print("\nGold database summary:")
    with engine.connect() as conn:
        for table in ["bays", "restrictions", "meters"]:
            try:
                count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                print(f"  {table}: {count} rows")
            except Exception:
                print(f"  {table}: not created")

    print("\nGold build complete (Postgres).")


if __name__ == "__main__":
    build()
