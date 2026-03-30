"""
build_gold.py - Builds the Gold SQLite database from Silver CSVs.

Usage:
    python scripts/build_gold.py

Reads from data/silver/, writes to data/gold/gold.db.
Drops and recreates all tables on each run.
"""

import os
import sqlite3
import pandas as pd

SILVER_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'silver')
GOLD_DIR = os.path.join(os.path.dirname(__file__), '..', 'data', 'gold')
GOLD_DB = os.path.join(GOLD_DIR, 'gold.db')


def build():
    os.makedirs(GOLD_DIR, exist_ok=True)

    print(f"Building Gold database at {GOLD_DB}\n")

    conn = sqlite3.connect(GOLD_DB)

    # Load and insert bays
    bays_path = os.path.join(SILVER_DIR, 'bays.csv')
    if os.path.exists(bays_path):
        print("Loading bays...")
        bays = pd.read_csv(bays_path)
        bays.to_sql('bays', conn, if_exists='replace', index=False)
        print(f"  Inserted {len(bays)} bays")

        # Create index on marker_id for fast joins
        conn.execute('CREATE INDEX IF NOT EXISTS idx_bays_marker ON bays(marker_id)')
    else:
        print("  WARNING: bays.csv not found in silver/")

    # Load and insert normalised restrictions
    rest_path = os.path.join(SILVER_DIR, 'restrictions_normalised.csv')
    if os.path.exists(rest_path):
        print("Loading restrictions...")
        restrictions = pd.read_csv(rest_path)
        restrictions.to_sql('restrictions', conn, if_exists='replace', index=False)
        print(f"  Inserted {len(restrictions)} restriction windows")

        # Index on bay_id for the restriction translator
        conn.execute('CREATE INDEX IF NOT EXISTS idx_rest_bay ON restrictions(bay_id)')
    else:
        print("  WARNING: restrictions_normalised.csv not found in silver/")

    # Load and insert meters
    meters_path = os.path.join(SILVER_DIR, 'meters.csv')
    if os.path.exists(meters_path):
        print("Loading meters...")
        meters = pd.read_csv(meters_path)
        meters.to_sql('meters', conn, if_exists='replace', index=False)
        print(f"  Inserted {len(meters)} meters")
    else:
        print("  WARNING: meters.csv not found in silver/")

    conn.commit()

    # Print summary
    print("\nGold database summary:")
    for table in ['bays', 'restrictions', 'meters']:
        try:
            count = conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
            print(f"  {table}: {count} rows")
        except sqlite3.OperationalError:
            print(f"  {table}: not created")

    conn.close()
    print(f"\nGold build complete: {GOLD_DB}")


if __name__ == '__main__':
    build()
