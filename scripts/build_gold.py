"""
build_gold.py
=============
Gold Layer - Enrichment & Final Output
FIT5120 TE31  MeloPark  Monash University

PURPOSE
-------
Reads the silver merged Parquet, applies enrichment functions,
and writes the final gold layer that powers the FastAPI backend.

Four enrichment functions are applied to every row:

1. is_active_now(row, now)
   Determines whether a restriction slot is currently active
   based on the current day-of-week and time-of-day.
   Returns True | False.

2. translate_sign(typedesc)
   Converts the raw CoM typedesc code (e.g. "2P MTR") into
   a plain English sentence a driver can understand.
   Returns a human-readable string.

3. classify_rule(typedesc)        [Epic 2]
   Derives (is_strict, rule_category) from a typedesc value.
   Used by the restriction evaluator to compute per-request verdicts.

4. parse_time_value(val)          [Epic 2]
   Normalises silver starttime/endtime values into Python time objects
   for Postgres TIME columns.

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
    is_strict           bool    True for clearway/tow/loading/no-stopping/disabled  [Epic 2]
    rule_category       str     timed|clearway|loading|no_standing|disabled|free|other  [Epic 2]

POSTGRES TABLES (--write-db)
-----------------------------
    bays                One row per unique bay (bay_id, lat, lon, has_restriction_data)
    bay_restrictions    One row per restriction slot with all gold columns

HOW TO RUN
----------
    cd melopark/
    python scripts/build_gold.py                      # build gold Parquet + search index
    python scripts/build_gold.py --export-csv         # also export CSV
    python scripts/build_gold.py --write-db           # write to Postgres via DATABASE_URL
    python scripts/build_gold.py --dry-run            # preview gold output only (no files written)
    python scripts/build_gold.py --search-only        # build search index only

OUTPUT
------
    data/gold/gold_bay_restrictions.parquet   (primary output for FastAPI)
    data/gold/gold_bay_restrictions.csv       (optional, for Supabase upload)
    data/gold/search_index.parquet            (search autocomplete index)
    data/gold/search_index.csv                (optional, for DB upload)
    data/gold/build_metadata.json             (build timestamp, stats)

DEPENDENCIES
------------
    pip install pandas pyarrow
    pip install sqlalchemy psycopg2-binary python-dotenv   # for --write-db

AUTHOR : FIT5120 TE31
DATE   : 14th, April 2026
"""

import argparse
import json
import logging
import os
import re
from datetime import datetime, time as dt_time, timezone
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

BACKEND_DIR = ROOT / "backend"

LANDMARKS_REAL = [
    {"name": "Melbourne Central", "sub": "Cnr La Trobe & Swanston St", "lat": -37.8102, "lng": 144.9628},
    {"name": "State Library Victoria", "sub": "328 Swanston St, Melbourne", "lat": -37.8098, "lng": 144.9652},
    {"name": "RMIT University", "sub": "124 La Trobe St, Melbourne", "lat": -37.8083, "lng": 144.9632},
    {"name": "Flinders Street Station", "sub": "Flinders St & Swanston St", "lat": -37.8183, "lng": 144.9671},
    {"name": "Federation Square", "sub": "Swanston St & Flinders St", "lat": -37.8180, "lng": 144.9691},
    {"name": "Queen Victoria Market", "sub": "513 Elizabeth St, Melbourne", "lat": -37.8076, "lng": 144.9568},
    {"name": "Melbourne Museum", "sub": "11 Nicholson St, Carlton", "lat": -37.8033, "lng": 144.9717},
    {"name": "Crown Casino", "sub": "8 Whiteman St, Southbank", "lat": -37.8228, "lng": 144.9575},
    {"name": "Old Melbourne Gaol", "sub": "377 Russell St, Melbourne", "lat": -37.8078, "lng": 144.9654},
    {"name": "Collins Street", "sub": "Collins St, Melbourne CBD", "lat": -37.8153, "lng": 144.9634},
    {"name": "Bourke Street Mall", "sub": "Bourke St, Melbourne CBD", "lat": -37.8136, "lng": 144.9653},
    {"name": "Elizabeth Street", "sub": "Elizabeth St, Melbourne CBD", "lat": -37.8136, "lng": 144.9601},
    {"name": "Swanston Street", "sub": "Swanston St, Melbourne CBD", "lat": -37.8136, "lng": 144.9663},
    {"name": "Chinatown Melbourne", "sub": "Little Bourke St, Melbourne", "lat": -37.8118, "lng": 144.9688},
    {"name": "Melbourne Town Hall", "sub": "90-120 Swanston St", "lat": -37.8148, "lng": 144.9665},
    {"name": "Emporium Melbourne", "sub": "287 Lonsdale St", "lat": -37.8120, "lng": 144.9644},
    {"name": "Docklands", "sub": "Harbour Esplanade, Docklands", "lat": -37.8157, "lng": 144.9397},
    {"name": "GPO Melbourne", "sub": "350 Bourke St, Melbourne", "lat": -37.8131, "lng": 144.9636},
]


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
# ENRICHMENT FUNCTION 3 — classify_rule()  [Epic 2]
# ═══════════════════════════════════════════════════════════════════════════

def classify_rule(typedesc: str) -> tuple[bool, str]:
    r"""Derive ``(is_strict, rule_category)`` from a raw CoM typedesc value.

    Categories (checked in this order — strict before general)
    ----------------------------------------------------------
    clearway      CW, TOW, CLEARWAY
    no_standing   NO STOP*, NO PARK*, NS prefix, section (621)
    loading       LZ, L/ZONE, LOADING
    disabled      DIS, DISAB*, DISABLE*
    timed         \dP, 1/2P, 1/4P, P\d, MINS, MTR, METER, TKT, etc.
    free          FREE
    other         BUS, TAXI, PERMIT, broken data, anything unrecognised

    ``is_strict`` is True for clearway, no_standing, loading, and disabled —
    categories where any non-permitted passenger vehicle would be illegally
    parked. A mid-stay activation of a disabled-bay window must therefore
    raise a strict warning so the driver can leave before the change.

    The order matters: "LZ 30MINS" must hit *loading* before the generic
    *timed* regex can match on "MINS".
    """
    if not typedesc or pd.isnull(typedesc):
        return False, "other"

    td = str(typedesc).strip().upper()

    # ── 1. Clearway / tow-away ───────────────────────────────────────
    # "CW TOW M-F 16:00-19:00", "CLEARWAY"
    if re.search(r"\bCW\b|\bTOW\b|CLEARWAY", td):
        return True, "clearway"

    # ── 2. No Stopping / No Parking ──────────────────────────────────
    # "No Stop M-F 7.00-09.30", "S/ No Stop", "NO STOPPING",
    # "NO PARKING", "No Park", "P/10 ... No Park", "(621)" section
    if re.search(r"NO\s*STOP|NO\s*PARK|\bNS\b|\(621\)", td):
        return True, "no_standing"

    # ── 3. Loading zone ──────────────────────────────────────────────
    # "LZ 30M ...", "LZ 15MINS ...", "L/Zone 30MINS ...",
    # "LZ30MINS", "Loading Zone 60mins"
    if re.search(r"\bLZ\b|LZ\d|L/ZONE|LOADING", td):
        return True, "loading"

    # ── 4. Disability permit ─────────────────────────────────────────
    # "2P DIS M-SAT", "P DIS AOT", "2PDis AOT", "DISABILITY",
    # "DISABLE", "Disabled Only"
    # is_strict=True (Bug 7 fix): a non-permitted driver occupying a
    # disabled-only bay is illegally parked, and a mid-stay activation
    # must trigger a strict warning in _find_strict_starting_during_stay.
    if re.search(r"DIS(?:AB|\b)|DISABLE", td):
        return True, "disabled"

    # ── 5. Timed parking (MUST come after strict categories) ─────────
    # Standard hour:  "2P", "4P MTR", "1P SUN", "1.5P"
    # Fractions:      "1/2P", "1/4P", "1/4 P"
    # Minutes prefix: "P 05MINS", "P10", "P5", "P 10MINS"
    # Minutes suffix: "15MINS P", "2Mins P"
    # Hour metered:   "1PM" (= 1-hour Parking Metered), "1 PM Mon-Sat"
    # Meter/ticket:   "P MTR", "METER", "TKT", "TICKET"
    # Permit area:    "RPA", "RPE"
    if re.search(
        r"\d+(?:\.\d+)?\s*P\b"     # 2P, 1P, 4P, 1.5P
        r"|1/[24]\s*P"              # 1/2P, 1/4P, 1/4 P
        r"|\bP\s*\d"               # P5, P10, P 05MINS
        r"|\d+\s*MINS?\b"          # 15MINS, 30MIN, 2Mins
        r"|\d+\s*MINUTES"          # 10 MINUTES
        r"|\d+\s*PM\b"             # 1PM (1-hour Parking Metered)
        r"|\bMTR\b|\bMETER\b"      # meter keywords
        r"|\bTKT\b|\bTICKET\b"     # ticket keywords
        r"|\bHR\b|\bHRS\b"         # hour keywords
        r"|\bRPA\b|\bRPE\b",       # residential parking area/exemption
        td,
    ):
        return False, "timed"

    # ── 6. Free parking ──────────────────────────────────────────────
    if td in ("FREE", "P FREE", "FREE PARKING"):
        return False, "free"

    return False, "other"


# ═══════════════════════════════════════════════════════════════════════════
# ENRICHMENT FUNCTION 4 — parse_time_value()  [Epic 2]
# ═══════════════════════════════════════════════════════════════════════════

def parse_time_value(val) -> dt_time | None:
    """Normalise a silver starttime/endtime value into a Python ``time`` object.

    Handles:
      - Python ``time`` objects (returned as-is)
      - Pandas ``Timestamp`` / ``datetime64`` (extract hour+minute)
      - ``"HH:MM"`` strings
      - ISO strings such as ``"0001-01-01T07:30:00+00:00"``
    """
    if val is None or (isinstance(val, float) and pd.isnull(val)):
        return None
    if isinstance(val, dt_time):
        return val
    if hasattr(val, "hour") and hasattr(val, "minute"):
        return dt_time(val.hour, val.minute)
    s = str(val).strip()
    # "HH:MM" format
    m = re.match(r"^(\d{1,2}):(\d{2})$", s)
    if m:
        return dt_time(int(m.group(1)), int(m.group(2)))
    # ISO with T separator — extract time portion
    if "T" in s:
        time_part = s.split("T")[1]
        parts = time_part.split(":")
        return dt_time(int(parts[0]), int(parts[1]))
    try:
        ts = pd.Timestamp(val)
        return dt_time(ts.hour, ts.minute)
    except Exception:
        return None


# ═══════════════════════════════════════════════════════════════════════════
# POSTGRES WRITER  [Epic 2]
# ═══════════════════════════════════════════════════════════════════════════

def _resolve_database_url(url: str) -> str:
    """Resolve relative sslrootcert paths against the backend directory.

    Mirrors the logic in ``backend/app/core/db.py`` so the pipeline script
    works when invoked from the repo root (not from inside backend/).
    """
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
    """Read DATABASE_URL from backend/.env (python-dotenv must be installed)."""
    from dotenv import load_dotenv

    env_path = BACKEND_DIR / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL not set. Create backend/.env (see backend/.env.example)."
        )
    return _resolve_database_url(url)


def dedup_restrictions_for_db(df: pd.DataFrame) -> pd.DataFrame:
    """Drop only exact restriction-window duplicates for DB loads.

    Using bay_id + typedesc alone collapses valid weekday/weekend windows that
    share the same sign code. Keep each unique time-window row.
    """
    dedup_keys = ["bay_id", "slot_num", "fromday", "today", "starttime", "endtime"]
    available_keys = [k for k in dedup_keys if k in df.columns]
    if len(available_keys) < len(dedup_keys):
        missing = sorted(set(dedup_keys) - set(available_keys))
        raise KeyError(f"Missing dedup columns for DB restriction load: {missing}")
    return df.drop_duplicates(subset=available_keys, keep="first")


def write_to_postgres(gold: pd.DataFrame) -> None:
    """Write the ``bays`` and ``bay_restrictions`` tables to Postgres.

    Unlike the gold Parquet (which only contains the sensor-joined subset),
    the Postgres tables include **all** restrictions from the full silver
    ``restrictions_long`` dataset.  This maximises restriction coverage
    (the sensor LEFT JOIN typically matches only a small fraction of bays).

    All datasets now share the **kerbsideid** namespace as ``bay_id``:
      - sensors:       kerbsideid → bay_id
      - restrictions:  deviceid   → bay_id  (deviceid = kerbsideid)
      - parking_bays:  kerbsideid → bay_id

    Geometry sources for the ``bays`` table (in priority order):
      1. ``sensors_clean.parquet``  — live sensor bays with lat/lon
      2. ``parking_bays.parquet``   — static bay geometry (kerbsideid → lat/lon)
      3. Restriction-only bays      — no geometry, lat/lon = NULL
    """
    from sqlalchemy import create_engine, text

    url = _get_database_url()
    engine = create_engine(url, pool_pre_ping=True)

    # ── Load the FULL restrictions from silver ───────────────────────────
    rest_long_path = SILVER_DIR / "restrictions_long.parquet"
    if not rest_long_path.exists():
        log.warning(
            "restrictions_long.parquet not found — falling back to gold-only "
            "(sensor-joined subset).  Re-run clean_to_silver.py to get full coverage."
        )
        all_rest = gold.copy()
    else:
        all_rest = pd.read_parquet(rest_long_path)
        log.info("Loaded restrictions_long.parquet → %d rows", len(all_rest))

    seg_rest_path = SILVER_DIR / "segment_restrictions_long.parquet"
    if seg_rest_path.exists():
        seg_rest = pd.read_parquet(seg_rest_path)
        log.info("Loaded segment_restrictions_long.parquet: %d rows", len(seg_rest))
        all_rest = pd.concat([all_rest, seg_rest], ignore_index=True)
        log.info(
            "Combined restrictions for DB: %d rows, %d bays",
            len(all_rest),
            all_rest["bay_id"].nunique(),
        )
    else:
        log.warning("segment_restrictions_long.parquet not found — direct restrictions only")

    # Normalise dtypes
    all_rest["bay_id"] = all_rest["bay_id"].astype(str)
    for col in ("fromday", "today"):
        all_rest[col] = pd.to_numeric(all_rest[col], errors="coerce").astype("Int64")
    if "duration_mins" in all_rest.columns:
        all_rest["duration_mins"] = pd.to_numeric(all_rest["duration_mins"], errors="coerce").astype("Int64")
    if "disabilityext_mins" in all_rest.columns:
        all_rest["disabilityext_mins"] = pd.to_numeric(all_rest["disabilityext_mins"], errors="coerce").astype("Int64")

    # Enrich: translate_sign, classify_rule (idempotent if already present)
    if "plain_english" not in all_rest.columns:
        all_rest["plain_english"] = all_rest["typedesc"].apply(translate_sign)
    if "is_strict" not in all_rest.columns or "rule_category" not in all_rest.columns:
        classified = all_rest["typedesc"].apply(classify_rule)
        all_rest["is_strict"] = classified.apply(lambda t: t[0])
        all_rest["rule_category"] = classified.apply(lambda t: t[1])

    restriction_bay_ids = set(all_rest["bay_id"].unique())
    log.info(
        "Full restrictions: %d rows across %d unique bays",
        len(all_rest), len(restriction_bay_ids),
    )

    # ── Build bays table from ALL geometry sources ───────────────────────
    geo_frames: list[pd.DataFrame] = []

    # Source 1: sensor bays (highest priority — live lat/lon)
    sensors_path = SILVER_DIR / "sensors_clean.parquet"
    if sensors_path.exists():
        sensors = pd.read_parquet(sensors_path)
        sensors["bay_id"] = sensors["bay_id"].astype(str)
        sensors["lat"] = pd.to_numeric(sensors["lat"], errors="coerce")
        sensors["lon"] = pd.to_numeric(sensors["lon"], errors="coerce")
        geo_frames.append(sensors[["bay_id", "lat", "lon"]].drop_duplicates("bay_id"))
        log.info("  Geometry source: sensors_clean → %d bays", len(geo_frames[-1]))

    # Source 2: parking_bays bronze (static bay geometry via kerbsideid)
    bronze_dir = ROOT / "data" / "bronze"
    bays_path = bronze_dir / "parking_bays.parquet"
    if bays_path.exists():
        pbays = pd.read_parquet(bays_path)
        if "kerbsideid" in pbays.columns:
            pbays["bay_id"] = pbays["kerbsideid"].astype(str).str.strip()
            lat_col = "latitude" if "latitude" in pbays.columns else "lat"
            lon_col = "longitude" if "longitude" in pbays.columns else "lon"
            if lat_col in pbays.columns and lon_col in pbays.columns:
                pbays["lat"] = pd.to_numeric(pbays[lat_col], errors="coerce")
                pbays["lon"] = pd.to_numeric(pbays[lon_col], errors="coerce")
                geo_frames.append(pbays[["bay_id", "lat", "lon"]].drop_duplicates("bay_id"))
                log.info("  Geometry source: parking_bays → %d bays", len(geo_frames[-1]))

    # Merge geometry: sensors first, then parking_bays for any gaps
    if geo_frames:
        all_geo = pd.concat(geo_frames, ignore_index=True).drop_duplicates("bay_id", keep="first")
    else:
        all_geo = pd.DataFrame(columns=["bay_id", "lat", "lon"])

    # Add restriction-only bays that have no geometry (lat/lon = NaN)
    rest_only_ids = restriction_bay_ids - set(all_geo["bay_id"])
    if rest_only_ids:
        rest_only = pd.DataFrame({
            "bay_id": list(rest_only_ids),
            "lat": pd.array([None] * len(rest_only_ids), dtype="Float64"),
            "lon": pd.array([None] * len(rest_only_ids), dtype="Float64"),
        })
        all_geo = pd.concat([all_geo, rest_only], ignore_index=True)
        log.info("  Restriction-only bays (no geometry): %d", len(rest_only_ids))

    bays_df = all_geo.copy()
    bays_df["bay_id"] = bays_df["bay_id"].astype(str).str.strip()
    bays_df = bays_df[
        bays_df["bay_id"].notna()
        & (bays_df["bay_id"] != "")
        & (bays_df["bay_id"].str.lower() != "nan")
        & (bays_df["bay_id"].str.lower() != "none")
    ].copy()
    bays_df["has_restriction_data"] = bays_df["bay_id"].isin(restriction_bay_ids)

    has_data = bays_df["has_restriction_data"].sum()
    log.info(
        "Bays table: %d total, %d with restriction data, %d without",
        len(bays_df), has_data, len(bays_df) - has_data,
    )

    # ── Prepare bay_restrictions table ───────────────────────────────────
    rest_cols = [
        "bay_id", "slot_num", "typedesc", "fromday", "today",
        "starttime", "endtime", "duration_mins", "disabilityext_mins",
        "plain_english", "is_strict", "rule_category",
    ]
    rest_df = all_rest[[c for c in rest_cols if c in all_rest.columns]].copy()
    rest_df["bay_id"] = rest_df["bay_id"].astype(str).str.strip()
    rest_df = rest_df[
        rest_df["bay_id"].notna()
        & (rest_df["bay_id"] != "")
        & (rest_df["bay_id"].str.lower() != "nan")
        & (rest_df["bay_id"].str.lower() != "none")
    ].copy()

    # Drop rows missing required day/time fields
    rest_df = rest_df.dropna(subset=["fromday", "today"])

    # Parse times to Python time objects for Postgres TIME columns
    for col in ("starttime", "endtime"):
        rest_df[col] = rest_df[col].apply(parse_time_value)
        null_count = rest_df[col].isnull().sum()
        if null_count > 0:
            log.warning("  %d rows with unparseable %s (will be dropped)", null_count, col)
    rest_df = rest_df.dropna(subset=["starttime", "endtime"])
    before_dedup = len(rest_df)
    rest_df = dedup_restrictions_for_db(rest_df)
    log.info("bay_restrictions dedup: %d -> %d rows", before_dedup, len(rest_df))

    log.info("bay_restrictions prepared: %d rows", len(rest_df))

    # ── Write tables ─────────────────────────────────────────────────────
    with engine.begin() as conn:
        conn.execute(text("DROP TABLE IF EXISTS bay_restrictions CASCADE"))
        conn.execute(text("DROP TABLE IF EXISTS bays CASCADE"))

    bays_df.to_sql("bays", engine, if_exists="append", index=False, method="multi")
    log.info("Wrote %d rows to `bays` table", len(bays_df))

    rest_df.to_sql("bay_restrictions", engine, if_exists="append", index=False, method="multi")
    log.info("Wrote %d rows to `bay_restrictions` table", len(rest_df))

    # ── Create indexes + constraints + missing optional columns ─────────
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE bays ADD PRIMARY KEY (bay_id)"))
        conn.execute(text(
            "ALTER TABLE bay_restrictions "
            "ADD COLUMN IF NOT EXISTS id SERIAL PRIMARY KEY"
        ))
        conn.execute(text(
            "ALTER TABLE bay_restrictions "
            "ADD COLUMN IF NOT EXISTS exemption TEXT"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS idx_bay_restrictions_bay_id "
            "ON bay_restrictions(bay_id)"
        ))

    log.info("Postgres write complete — tables: bays, bay_restrictions")


# ═══════════════════════════════════════════════════════════════════════════
# GOLD BUILD PIPELINE
# ═══════════════════════════════════════════════════════════════════════════

def build_gold(
    dry_run: bool = False,
    export_csv: bool = False,
    write_db: bool = False,
    verbose: bool = False,
) -> pd.DataFrame:
    """
    Build the gold layer from silver data.

    Steps:
    1. Load silver merged Parquet
    2. Apply translate_sign() → column 'plain_english'
    3. Apply classify_rule() → columns 'is_strict', 'rule_category'
    4. Apply is_active_now() → column 'is_active_now'
    5. Select and order final gold columns
    6. Save to Parquet (and optionally CSV)
    7. Optionally write to Postgres (--write-db)
    8. Write metadata

    Parameters
    ----------
    dry_run : bool     Run without writing output files
    export_csv : bool  Also export gold data as CSV (for Supabase upload)
    write_db : bool    Write bays + bay_restrictions tables to Postgres
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
    bays_with_data = df[df["typedesc"].notna()]["bay_id"].nunique()
    log.info("Bays with restriction data in merged: %d", bays_with_data)
    if bays_with_data < 100:
        log.warning("Low coverage — re-run clean_to_silver.py with updated bronze data")

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

    # ── Enrichment 2: classify_rule()  [Epic 2] ─────────────────────────
    log.info("Applying classify_rule() …")
    classified = df["typedesc"].apply(classify_rule)
    df["is_strict"]      = classified.apply(lambda t: t[0])
    df["rule_category"]  = classified.apply(lambda t: t[1])

    log.info(
        "  Rule categories: %s",
        df["rule_category"].value_counts().to_dict(),
    )
    strict_count = int(df["is_strict"].sum()) if len(df) > 0 else 0
    log.info("  Strict restrictions: %d", strict_count)

    # ── Enrichment 3: is_active_now() ───────────────────────────────────
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
        "is_strict",
        "rule_category",
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

    if verbose and "typedesc" in gold.columns:
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

    # ── Write to Postgres (optional — for FastAPI backend) ───────────────
    if write_db:
        write_to_postgres(gold)

    # ── Write metadata ───────────────────────────────────────────────────
    meta = {
        "pipeline_stage":  "gold",
        "built_at":         datetime.now(timezone.utc).isoformat(),
        "evaluated_at":     now.strftime("%A %Y-%m-%d %H:%M:%S"),
        "notes": [
            "is_active_now reflects the restriction state at build time.",
            "In production, verdicts are computed per-request by restriction_evaluator.py.",
            "plain_english, is_strict, rule_category are stable and cached in Postgres.",
        ],
        "stats": {
            "total_rows":          len(gold),
            "unique_bays":         int(gold["bay_id"].nunique()),
            "active_restrictions": int(gold["is_active_now"].sum()),
            "strict_restrictions": int(gold["is_strict"].sum()),
            "rule_categories":     gold["rule_category"].value_counts().to_dict(),
            "columns":             list(gold.columns),
        },
        "api_usage": {
            "evaluate_endpoint": "GET /api/bays/{bay_id}/evaluate?arrival_iso=...&duration_mins=...",
            "bulk_endpoint":     "GET /api/bays/evaluate-bulk?arrival_iso=...&bbox=...",
            "flow":              "bay_id → bays table (has_restriction_data) → bay_restrictions → evaluator",
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


def build_search_index(export_csv: bool = False, verbose: bool = False) -> pd.DataFrame:
    """
    Build a unified search index from landmarks + cleaned addresses + streets.

    Output columns:
        name, sub, category, lat, lng
    """
    log.info("=" * 60)
    log.info("MeloPark — Search Index Build")
    log.info("Input:  %s", SILVER_DIR)
    log.info("Output: %s", GOLD_DIR)
    log.info("=" * 60)

    frames: list[pd.DataFrame] = []

    landmarks = pd.DataFrame(LANDMARKS_REAL)
    landmarks["category"] = "landmark"
    frames.append(landmarks[["name", "sub", "category", "lat", "lng"]])

    addresses_path = SILVER_DIR / "addresses_clean.parquet"
    if addresses_path.exists():
        addresses = pd.read_parquet(addresses_path)
        frames.append(addresses[["name", "sub", "category", "lat", "lng"]])
        log.info("Loaded addresses_clean.parquet -> %d rows", len(addresses))
    else:
        log.warning("addresses_clean.parquet not found. Address rows will be omitted.")

    streets_path = SILVER_DIR / "streets_clean.parquet"
    if streets_path.exists():
        streets = pd.read_parquet(streets_path)
        frames.append(streets[["name", "sub", "category", "lat", "lng"]])
        log.info("Loaded streets_clean.parquet   -> %d rows", len(streets))
    else:
        log.warning("streets_clean.parquet not found. Street rows will be omitted.")

    if not frames:
        raise FileNotFoundError("No input frames available to build search_index.")

    search_index = pd.concat(frames, ignore_index=True)
    search_index["name"] = search_index["name"].astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
    search_index["sub"] = search_index["sub"].fillna("").astype(str).str.replace(r"\s+", " ", regex=True).str.strip()
    search_index["category"] = search_index["category"].astype(str).str.lower().str.strip()
    search_index["lat"] = pd.to_numeric(search_index["lat"], errors="coerce")
    search_index["lng"] = pd.to_numeric(search_index["lng"], errors="coerce")
    search_index = search_index.dropna(subset=["name", "category", "lat", "lng"])
    search_index = search_index[search_index["name"] != ""]

    category_order = {"landmark": 0, "street": 1, "address": 2}
    search_index["_priority"] = search_index["category"].map(category_order).fillna(9)
    search_index = search_index.sort_values(["_priority", "name", "sub"])
    search_index = search_index.drop_duplicates(subset=["category", "name", "lat", "lng"], keep="first")
    search_index = search_index.drop(columns=["_priority"]).reset_index(drop=True)

    if verbose:
        log.info("Rows by category:\n%s", search_index["category"].value_counts().to_string())

    parquet_path = GOLD_DIR / "search_index.parquet"
    search_index.to_parquet(parquet_path, index=False, engine="pyarrow")
    log.info("Saved search_index.parquet      (%d rows)", len(search_index))

    if export_csv:
        csv_path = GOLD_DIR / "search_index.csv"
        search_index.to_csv(csv_path, index=False)
        log.info("Saved search_index.csv          (%d rows)", len(search_index))

    meta = {
        "pipeline_stage": "gold_search_index",
        "built_at": datetime.now(timezone.utc).isoformat(),
        "stats": {
            "total_rows": len(search_index),
            "by_category": search_index["category"].value_counts().to_dict(),
            "columns": list(search_index.columns),
        },
    }
    meta_path = GOLD_DIR / "search_index_metadata.json"
    with open(meta_path, "w") as f:
        json.dump(meta, f, indent=2)
    log.info("Metadata -> %s", meta_path.name)

    return search_index


# ─── CLI ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="MeloPark Gold Layer — Enrich silver data with translations and active flags",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/build_gold.py                      # build gold Parquet + search index
  python scripts/build_gold.py --export-csv         # also export CSV for Supabase
  python scripts/build_gold.py --write-db           # write bays + bay_restrictions to Postgres
  python scripts/build_gold.py --dry-run            # preview gold output only
  python scripts/build_gold.py --verbose            # show translation samples
  python scripts/build_gold.py --search-only        # build search index only

Test translate_sign() directly:
  python -c "from scripts.build_gold import translate_sign; print(translate_sign('2P MTR'))"
        """,
    )

    parser.add_argument("--dry-run",    action="store_true", help="Run without writing output files")
    parser.add_argument("--export-csv", action="store_true", help="Also export CSV for Supabase upload")
    parser.add_argument("--write-db",   action="store_true", help="Write bays + bay_restrictions to Postgres via DATABASE_URL")
    parser.add_argument("--verbose",    action="store_true", help="Show detailed stats and translation samples")
    parser.add_argument("--search-only", action="store_true", help="Build only search_index outputs")

    args = parser.parse_args()
    if args.search_only:
        build_search_index(export_csv=args.export_csv, verbose=args.verbose)
    else:
        build_gold(
            dry_run=args.dry_run,
            export_csv=args.export_csv,
            write_db=args.write_db,
            verbose=args.verbose,
        )
        if not args.dry_run:
            build_search_index(export_csv=args.export_csv, verbose=args.verbose)
