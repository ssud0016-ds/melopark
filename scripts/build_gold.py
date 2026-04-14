"""
build_gold.py
=============
Gold Layer - Enrichment & Final Output
FIT5120 TE31  MeloPark  Monash University

PURPOSE
-------
Reads the silver merged Parquet, applies two enrichment functions,
and writes the final gold layer that powers the Flask/FastAPI backend.

Two enrichment functions are applied to every row:

1. is_active_now(row, now)
   Determines whether a restriction slot is currently active
   based on the current day-of-week and time-of-day.
   Returns True | False.

2. translate_sign(typedesc)
   Converts the raw CoM typedesc code (e.g. "2P MTR") into
   a plain English sentence a driver can understand.
   Returns a human-readable string.

GOLD LAYER SCHEMA (output columns)
------------------------------------
    bay_id              str     Unique bay identifier
    slot_num            int     Restriction slot number (1–8)
    lat                 float   Sensor latitude (WGS84)
    lon                 float   Sensor longitude (WGS84)
    status              str     'Present' | 'Absent' (current sensor reading)
    typedesc            str     Raw sign code e.g. '2P MTR'
    fromday             int     Restriction start day (0=Sun … 6=Sat)
    today               int     Restriction end day
    starttime           str     Restriction start time 'HH:MM'
    endtime             str     Restriction end time 'HH:MM'
    duration_mins       int     Max stay in minutes (null = no limit)
    disabilityext_mins  int     Extended time for disability permit (minutes)
    plain_english       str     Human-readable translation of the sign
    is_active_now       bool    True if restriction is active right now

HOW IT IS USED
--------------
The gold Parquet is uploaded to Supabase (or read by the Flask API directly).
The Flask endpoint does:
    1. Receive GPS lat/lon
    2. Find nearest sensor by Haversine distance
    3. SELECT * FROM gold WHERE bay_id = nearest.bay_id
    4. Return plain_english + is_active_now to the React frontend

HOW TO RUN
----------
    cd melopark/
    python scripts/build_gold.py

    # Rebuild and also export to CSV (for Supabase upload):
    python scripts/build_gold.py --export-csv

    # Preview without writing:
    python scripts/build_gold.py --dry-run

OUTPUT
------
    data/gold/gold_bay_restrictions.parquet   (primary output for Flask API)
    data/gold/gold_bay_restrictions.csv       (optional, for Supabase upload)
    data/gold/build_metadata.json             (build timestamp, stats)

DEPENDENCIES
------------
    pip install pandas pyarrow

AUTHOR : FIT5120 TE31
DATE   : 13th, April 2026
"""

import argparse
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# ─── LOGGING ────────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("build_gold")

# ─── PATHS ──────────────────────────────────────────────────────────────────

ROOT       = Path(__file__).resolve().parent.parent
SILVER_DIR = ROOT / "data" / "silver"
GOLD_DIR   = ROOT / "data" / "gold"
GOLD_DIR.mkdir(parents=True, exist_ok=True)


# ═══════════════════════════════════════════════════════════════════════════
# ENRICHMENT FUNCTION 1 — is_active_now()
# ═══════════════════════════════════════════════════════════════════════════

def is_active_now(row: pd.Series, now: datetime | None = None) -> bool:
    """
    Determine whether a restriction slot is currently active.

    A slot is active if ALL of the following are true:
      - current day-of-week is within [fromday, today] (inclusive)
      - current time (HH:MM) is within [starttime, endtime)

    Day-of-week convention (matches CoM dataset AND Python datetime.weekday):
      CoM:    0=Sunday,  1=Monday,  …  6=Saturday
      Python: 0=Monday,  1=Tuesday, …  6=Sunday

    ⚠ CoM uses 0=Sunday convention.  This function converts automatically.

    Parameters
    ----------
    row : pd.Series
        A single row from the silver merged DataFrame.
        Required fields: fromday, today, starttime, endtime
    now : datetime | None
        The current datetime to evaluate against.
        Defaults to datetime.now() (i.e. real current time).
        Pass a fixed datetime for testing.

    Returns
    -------
    bool  True if this slot is active right now, False otherwise.

    Examples
    --------
    >>> import pandas as pd
    >>> from datetime import datetime
    >>> row = pd.Series({
    ...     'fromday': 1,     # Monday (CoM convention: 1=Monday)
    ...     'today':   5,     # Friday
    ...     'starttime': '09:30',
    ...     'endtime':   '18:30',
    ... })
    >>> # Monday at 10:00 — should be active
    >>> is_active_now(row, datetime(2026, 4, 13, 10, 0))
    True
    >>> # Sunday at 10:00 — should NOT be active (Sunday = 0)
    >>> is_active_now(row, datetime(2026, 4, 12, 10, 0))
    False
    >>> # Monday at 19:00 (after endtime) — should NOT be active
    >>> is_active_now(row, datetime(2026, 4, 13, 19, 0))
    False
    """
    if now is None:
        now = datetime.now()

    # Validate required fields
    fromday   = row.get("fromday")
    today_val = row.get("today")
    starttime = row.get("starttime")
    endtime   = row.get("endtime")

    if any(pd.isnull(v) for v in [fromday, today_val, starttime, endtime]):
        return False

    # CoM day convention: 0=Sunday, 1=Monday … 6=Saturday
    # Python's .weekday(): 0=Monday … 6=Sunday
    # Convert Python weekday → CoM weekday:
    #   Python 0 (Mon) → CoM 2, Python 6 (Sun) → CoM 1
    # Simpler: use isoweekday(): 1=Mon … 7=Sun, then map 7→0
    isoday     = now.isoweekday()          # 1=Mon … 7=Sun
    com_day    = 0 if isoday == 7 else isoday   # 0=Sun, 1=Mon … 6=Sat

    # Check day range
    try:
        from_d = int(fromday)
        to_d   = int(today_val)
    except (ValueError, TypeError):
        return False

    if not (from_d <= com_day <= to_d):
        return False

    # Parse times  →  total minutes from midnight
    try:
        start_h, start_m = map(int, str(starttime).split(":")[:2])
        end_h,   end_m   = map(int, str(endtime).split(":")[:2])
    except (ValueError, AttributeError):
        return False

    start_total = start_h * 60 + start_m
    end_total   = end_h   * 60 + end_m
    now_total   = now.hour * 60 + now.minute

    return start_total <= now_total < end_total


# ═══════════════════════════════════════════════════════════════════════════
# ENRICHMENT FUNCTION 2 — translate_sign()
# ═══════════════════════════════════════════════════════════════════════════

def translate_sign(typedesc: str) -> str:
    """
    Convert a raw CoM parking restriction code to plain English.

    This is a rule-based parser (no ML required) that handles all known
    typedesc values from the City of Melbourne restrictions dataset.

    Rules are applied in priority order (most specific first).

    Parameters
    ----------
    typedesc : str
        Raw typedesc value from the CoM restrictions dataset.
        Examples: '2P MTR', 'NO STOPPING', 'DIS ONLY', '1/2P'

    Returns
    -------
    str
        Plain English description. Never raises; returns typedesc as
        fallback if no rule matches.

    CoM typedesc patterns handled
    ------------------------------
    NO STOPPING       → Cannot stop at all (tow-away zone)
    NO PARKING        → Can stop briefly for pick-up/drop-off only
    DIS               → Disability permit holders only
    LOADING           → Loading zone (commercial vehicles only)
    BUS               → Bus zone only
    TAXI              → Taxi zone only
    <N>P MTR          → N-hour paid meter parking
    <N>P TKT / TICKET → N-hour ticket area parking
    <N>P              → N-hour free timed parking
    1/2P              → 30-minute free timed parking
    FREE              → Free parking (no time limit stated)

    Examples
    --------
    >>> translate_sign('2P MTR')
    'Park for up to 2 hours. Pay at the parking meter.'
    >>> translate_sign('NO STOPPING')
    'No stopping — you cannot stop here at all. Tow-away zone.'
    >>> translate_sign('DIS ONLY')
    'Disability parking permit required. Permit holders may stay up to double the stated time.'
    >>> translate_sign('1/2P')
    'Park for up to 30 minutes. No payment required.'
    """
    if not typedesc or pd.isnull(typedesc):
        return "Restriction details not available."

    td = str(typedesc).strip().upper()

    # ── Absolute prohibitions ────────────────────────────────────────────

    if "NO STOPPING" in td or "CLEARWAY" in td:
        return (
            "No stopping — you cannot stop here at all during these hours. "
            "Tow-away zone. Vehicles will be removed at the owner's expense."
        )

    if "NO PARKING" in td:
        return (
            "No parking — you may stop only briefly to drop off or pick up a passenger. "
            "You cannot leave your vehicle unattended here during these hours."
        )

    # ── Special zones ────────────────────────────────────────────────────

    if re.search(r"\bDIS\b", td) or "DISABILITY" in td:
        return (
            "Disability parking permit required. "
            "Only vehicles displaying a valid Victorian disability parking permit may park here. "
            "Permit holders may stay up to double the standard time limit."
        )

    if "LOADING" in td:
        return (
            "Loading zone — for commercial vehicles loading or unloading goods only. "
            "Passenger vehicles may not use this space during these hours."
        )

    if "BUS" in td:
        return "Bus zone — buses only during these hours. All other vehicles must not stop here."

    if re.search(r"\bTAXI\b", td):
        return "Taxi zone — taxis only during these hours. Passenger vehicles must not stop here."

    if "PERMIT" in td:
        return (
            "Permit zone — only vehicles with a valid parking permit for this area "
            "may park here during the stated hours."
        )

    # ── Half-hour timed parking ──────────────────────────────────────────

    if "1/2P" in td:
        is_paid = "MTR" in td or "METER" in td or "TKT" in td or "TICKET" in td
        payment = " Pay at the parking meter." if "MTR" in td or "METER" in td else \
                  " Display a valid parking ticket." if "TKT" in td or "TICKET" in td else \
                  " No payment required."
        return f"Park for up to 30 minutes.{payment}"

    # ── Timed paid parking (meter or ticket) ────────────────────────────

    meter_match  = re.match(r"(\d+(?:\.\d+)?)P\s+(MTR|METER)", td)
    ticket_match = re.match(r"(\d+(?:\.\d+)?)P\s+(TKT|TICKET)", td)

    if meter_match:
        hours = float(meter_match.group(1))
        time_str = "1 hour" if hours == 1 else f"{int(hours)} hours" if hours == int(hours) else f"{hours} hours"
        return (
            f"Park for up to {time_str}. "
            "Pay at the parking meter before leaving your vehicle. "
            "A fine of approximately $115 applies if you overstay."
        )

    if ticket_match:
        hours = float(ticket_match.group(1))
        time_str = "1 hour" if hours == 1 else f"{int(hours)} hours" if hours == int(hours) else f"{hours} hours"
        return (
            f"Park for up to {time_str}. "
            "Display a valid parking ticket purchased from the ticket machine."
        )

    # ── Timed free parking ───────────────────────────────────────────────

    timed_free = re.match(r"(\d+(?:\.\d+)?)P\b", td)
    if timed_free:
        hours = float(timed_free.group(1))
        time_str = "1 hour" if hours == 1 else f"{int(hours)} hours" if hours == int(hours) else f"{hours} hours"
        return f"Park for up to {time_str}. No payment required."

    # ── Free parking (no time stated) ───────────────────────────────────

    if td in ("FREE", "P FREE", "FREE PARKING"):
        return "Free parking — no time limit or payment required during these hours."

    # ── Fallback ─────────────────────────────────────────────────────────

    return f"Restriction: {typedesc}. Check the physical sign for full details."


# ═══════════════════════════════════════════════════════════════════════════
# GOLD BUILD PIPELINE
# ═══════════════════════════════════════════════════════════════════════════

def build_gold(
    dry_run: bool = False,
    export_csv: bool = False,
    verbose: bool = False,
) -> pd.DataFrame:
    """
    Build the gold layer from silver data.

    Steps:
    1. Load silver merged Parquet
    2. Apply is_active_now() → column 'is_active_now'
    3. Apply translate_sign() → column 'plain_english'
    4. Select and order final gold columns
    5. Save to Parquet (and optionally CSV)
    6. Write metadata

    Parameters
    ----------
    dry_run : bool     Run without writing output files
    export_csv : bool  Also export gold data as CSV (for Supabase upload)
    verbose : bool     Print per-typedesc translation samples

    Returns
    -------
    pd.DataFrame  Gold DataFrame
    """
    log.info("=" * 60)
    log.info("MeloPark — Gold Layer Build")
    log.info("Input:  %s", SILVER_DIR)
    log.info("Output: %s", GOLD_DIR)
    log.info("=" * 60)

    # ── Load silver ──────────────────────────────────────────────────────
    merged_path = SILVER_DIR / "merged.parquet"
    if not merged_path.exists():
        raise FileNotFoundError(
            f"Silver merged file not found: {merged_path}\n"
            "Run clean_to_silver.py first."
        )

    df = pd.read_parquet(merged_path)
    log.info("Loaded merged.parquet  →  %d rows, %d columns", len(df), len(df.columns))

    # ── Drop rows with no typedesc (sensors with no restriction data) ────
    no_typedesc = df["typedesc"].isnull()
    if no_typedesc.sum() > 0:
        log.info("Dropping %d rows with no restriction data (sensors only bays)", no_typedesc.sum())
        df = df[~no_typedesc].copy()

    # ── Enrichment 1: translate_sign() ──────────────────────────────────
    log.info("Applying translate_sign() to %d rows…", len(df))
    df["plain_english"] = df["typedesc"].apply(translate_sign)

    if verbose:
        samples = df[["typedesc", "plain_english"]].drop_duplicates("typedesc").head(20)
        log.info("Translation samples:\n%s", samples.to_string(index=False))

    # ── Enrichment 2: is_active_now() ───────────────────────────────────
    log.info("Applying is_active_now() at current time…")
    now = datetime.now()
    log.info("  Evaluating at: %s", now.strftime("%A %Y-%m-%d %H:%M"))

    df["is_active_now"] = df.apply(lambda row: is_active_now(row, now), axis=1)

    active_count = df["is_active_now"].sum()
    log.info(
        "  Active restrictions: %d / %d (%.1f%%)",
        active_count, len(df),
        100 * active_count / max(len(df), 1),
    )

    # ── Select final gold columns ─────────────────────────────────────────
    GOLD_COLUMNS = [
        "bay_id",
        "slot_num",
        "lat",
        "lon",
        "status",
        "typedesc",
        "fromday",
        "today",
        "starttime",
        "endtime",
        "duration_mins",
        "disabilityext_mins",
        "exemption",
        "plain_english",
        "is_active_now",
    ]

    # Keep only columns that exist (some may be absent if silver was minimal)
    available = [c for c in GOLD_COLUMNS if c in df.columns]
    missing   = [c for c in GOLD_COLUMNS if c not in df.columns]
    if missing:
        log.warning("Gold columns not in silver data (will be absent): %s", missing)

    gold = df[available].copy()

    # ── Fix dtypes ───────────────────────────────────────────────────────
    gold["bay_id"]   = gold["bay_id"].astype(str)
    gold["lat"]      = pd.to_numeric(gold["lat"],  errors="coerce")
    gold["lon"]      = pd.to_numeric(gold["lon"],  errors="coerce")
    gold["fromday"]  = pd.to_numeric(gold["fromday"], errors="coerce").astype("Int64")
    gold["today"]    = pd.to_numeric(gold["today"],   errors="coerce").astype("Int64")

    if "duration_mins" in gold.columns:
        gold["duration_mins"] = pd.to_numeric(gold["duration_mins"], errors="coerce").astype("Int64")
    if "disabilityext_mins" in gold.columns:
        gold["disabilityext_mins"] = pd.to_numeric(gold["disabilityext_mins"], errors="coerce").astype("Int64")

    # ── Summary stats ────────────────────────────────────────────────────
    log.info("Gold layer summary:")
    log.info("  Total rows:           %d", len(gold))
    log.info("  Unique bays:          %d", gold["bay_id"].nunique())
    log.info("  Restrictions active:  %d", gold["is_active_now"].sum())

    if verbose:
        log.info("\nActive restrictions by typedesc:\n%s",
                 gold[gold["is_active_now"]]["typedesc"].value_counts().head(15).to_string())

    if dry_run:
        log.info("DRY RUN — no files written.")
        return gold

    # ── Save Parquet ─────────────────────────────────────────────────────
    parquet_path = GOLD_DIR / "gold_bay_restrictions.parquet"
    gold.to_parquet(parquet_path, index=False, engine="pyarrow")
    size_kb = parquet_path.stat().st_size / 1024
    log.info("Saved gold_bay_restrictions.parquet  (%.1f KB, %d rows)", size_kb, len(gold))

    # ── Save CSV (optional — for Supabase import) ────────────────────────
    if export_csv:
        csv_path = GOLD_DIR / "gold_bay_restrictions.csv"
        gold.to_csv(csv_path, index=False)
        log.info("Saved gold_bay_restrictions.csv  (%d rows)", len(gold))
        log.info("")
        log.info("To upload to Supabase:")
        log.info("  1. Go to your Supabase project → Table Editor")
        log.info("  2. Create table 'gold_bay_restrictions'")
        log.info("  3. Import CSV → choose gold_bay_restrictions.csv")
        log.info("  4. Set bay_id as text, is_active_now as boolean")

    # ── Write metadata ───────────────────────────────────────────────────
    meta = {
        "pipeline_stage":  "gold",
        "built_at":         datetime.now(timezone.utc).isoformat(),
        "evaluated_at":     now.strftime("%A %Y-%m-%d %H:%M:%S"),
        "notes": [
            "is_active_now reflects the restriction state at build time.",
            "In production, is_active_now should be computed per-request in the Flask API.",
            "plain_english is stable and can be cached.",
            "Upload gold_bay_restrictions.csv to Supabase for API use.",
        ],
        "stats": {
            "total_rows":          len(gold),
            "unique_bays":         int(gold["bay_id"].nunique()),
            "active_restrictions": int(gold["is_active_now"].sum()),
            "columns":             list(gold.columns),
        },
        "api_usage": {
            "endpoint":     "GET /api/sign?lat=-37.8136&lon=144.9631",
            "flow":         "GPS lat/lon → nearest sensor by Haversine → bay_id → gold table",
            "query":        "SELECT * FROM gold_bay_restrictions WHERE bay_id = :bay_id",
            "no_street_name": "The restrictions dataset has NO street name — do not filter by street.",
        },
    }

    meta_path = GOLD_DIR / "build_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    log.info("Metadata → %s", meta_path.name)

    log.info("=" * 60)
    log.info("Gold layer build complete.")
    log.info("=" * 60)

    return gold


# ─── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="MeloPark Gold Layer — Enrich silver data with translations and active flags",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/build_gold.py                      # build gold Parquet
  python scripts/build_gold.py --export-csv         # also export CSV for Supabase
  python scripts/build_gold.py --dry-run            # preview without writing
  python scripts/build_gold.py --verbose            # show translation samples

Test translate_sign() directly:
  python -c "from scripts.build_gold import translate_sign; print(translate_sign('2P MTR'))"
        """,
    )

    parser.add_argument("--dry-run",    action="store_true", help="Run without writing output files")
    parser.add_argument("--export-csv", action="store_true", help="Also export CSV for Supabase upload")
    parser.add_argument("--verbose",    action="store_true", help="Show detailed stats and translation samples")

    args = parser.parse_args()
    build_gold(dry_run=args.dry_run, export_csv=args.export_csv, verbose=args.verbose)
