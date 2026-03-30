"""
Restriction service - parses CoM restriction data and translates
it into plain English verdicts.

This is the core logic for Epic 2. Each bay can have multiple
restriction windows stored as numbered column sets in the CoM API
(FromDay1, ToDay1, StartTime1... FromDay2, ToDay2...).

The translator:
1. Fetches all restriction windows for a bay
2. Finds which window is active at the arrival time
3. Checks if any dangerous transitions (clearways, tow zones) occur
   during the planned stay
4. Returns a human readable verdict
"""

import requests
from datetime import datetime, timedelta

from app.db import get_connection
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

COM_RESTRICTIONS_URL = (
    "https://data.melbourne.vic.gov.au/api/explore/v2.1/catalog/datasets"
    "/on-street-car-park-bay-restrictions/records"
)

DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]


def get_bay_restrictions(bay_id):
    """
    Fetch and normalise restriction windows for a given bay.
    Returns a list of restriction window dicts, or None on error.
    """
    try:
        # 1) Prefer local Gold/Postgres restrictions (static data).
        engine = get_connection()
        if engine is not None:
            try:
                with engine.connect() as conn:
                    rows = conn.execute(
                        text("SELECT * FROM restrictions WHERE bay_id::text = :bay_id"),
                        {"bay_id": str(bay_id)},
                    ).fetchall()

                if rows:
                    return _windows_from_db_rows(rows)
            except SQLAlchemyError as e:
                # If DB is down or misconfigured, fall back to CoM API.
                print(f"[restriction_service] DB lookup failed for {bay_id}: {e}")

        # 2) Fall back to CoM API (wide-column format) if no DB data.
        params = {
            "limit": 10,
            "where": f'bayid="{bay_id}"',
        }
        resp = requests.get(COM_RESTRICTIONS_URL, params=params, timeout=30)
        resp.raise_for_status()
        raw = resp.json()

        records = raw.get("results", [])
        if not records:
            return []

        # Parse the wide-column format into normalised windows
        windows = []
        for record in records:
            windows.extend(_parse_restriction_windows(record))

        return windows

    except Exception as e:
        print(f"[restriction_service] Error fetching restrictions for {bay_id}: {e}")
        return None


def _windows_from_db_rows(rows):
    """
    Convert normalised `restrictions` rows from the Gold database into the
    window dict shape expected by translate_restriction().
    """
    windows = []

    for row in rows:
        r = row._mapping  # SQLAlchemy Row -> mapping for column access

        type_desc = str(r.get("type_desc") or "")
        if type_desc.upper().endswith("OLD"):
            continue

        from_day = _safe_int(r.get("from_day"))
        to_day = _safe_int(r.get("to_day"))

        window = {
            "from_day": from_day,
            "to_day": to_day,
            "start_time": r.get("start_time") or "",
            "end_time": r.get("end_time") or "",
            "type_desc": type_desc,
            # Gold tables use *_min column names from clean_to_silver.py
            "duration": _safe_int(r.get("duration_min")),
            "disability_ext": _safe_int(r.get("disability_ext_min")),
            "effective_on_ph": r.get("effective_on_ph"),
            "exemption": r.get("exemption") or "",
        }

        if window["from_day"] is not None and window["to_day"] is not None:
            window["day_range"] = _format_day_range(window["from_day"], window["to_day"])

        windows.append(window)

    return windows


def translate_restriction(bay_id, arrival, duration_min):
    """
    The restriction translator. Takes a bay, arrival time, and planned
    duration, then returns a verdict dict.

    Returns dict with:
        - can_park (bool): whether parking is allowed at arrival time
        - verdict (str): plain English summary
        - time_limit (str): how long you can stay
        - expires_at (str): when your time runs out
        - cost_estimate (str): estimated cost if metered
        - warnings (list[str]): any trap conditions (clearways etc)
        - active_restriction (dict): the raw restriction window that applies
    """
    windows = get_bay_restrictions(bay_id)

    if windows is None:
        return None

    if not windows:
        return {
            "bay_id": bay_id,
            "can_park": True,
            "verdict": "No restriction data found for this bay. Check signage on site.",
            "time_limit": None,
            "expires_at": None,
            "cost_estimate": None,
            "warnings": ["No restriction data available. Verify with physical signs."],
            "active_restriction": None,
        }

    arrival_day = arrival.weekday()
    # Python weekday: Mon=0, Sun=6. CoM uses: Sun=0, Sat=6.
    com_day = (arrival_day + 1) % 7
    arrival_time = arrival.time()

    # Find the active restriction window
    active = _find_active_window(windows, com_day, arrival_time)

    if active is None:
        return {
            "bay_id": bay_id,
            "can_park": True,
            "verdict": "No timed restriction applies right now. You can park here, but check signage for any permanent restrictions.",
            "time_limit": "No time limit currently",
            "expires_at": None,
            "cost_estimate": "Free (no active meter period)",
            "warnings": [],
            "active_restriction": None,
        }

    # Build the verdict
    type_desc = active.get("type_desc", "")
    duration = active.get("duration")
    end_time_str = active.get("end_time", "")
    is_disabled = "DIS" in type_desc.upper()
    is_no_parking = "NO PARK" in type_desc.upper() or "NO STOPPING" in type_desc.upper()
    is_clearway = "CLEARWAY" in type_desc.upper() or "CLW" in type_desc.upper()
    is_loading = "LOAD" in type_desc.upper()
    is_metered = "METER" in type_desc.upper() or "MTR" in type_desc.upper()

    # Can't park cases
    if is_no_parking or is_clearway:
        return {
            "bay_id": bay_id,
            "can_park": False,
            "verdict": f"You cannot park here right now. {type_desc} is in effect until {end_time_str}.",
            "time_limit": None,
            "expires_at": None,
            "cost_estimate": None,
            "warnings": [f"{type_desc} active. Your car may be towed."],
            "active_restriction": active,
        }

    if is_loading:
        return {
            "bay_id": bay_id,
            "can_park": False,
            "verdict": f"This bay is a loading zone ({type_desc}) until {end_time_str}. General parking is not permitted.",
            "time_limit": None,
            "expires_at": None,
            "cost_estimate": None,
            "warnings": ["Loading zone. General vehicles cannot park here."],
            "active_restriction": active,
        }

    if is_disabled:
        return {
            "bay_id": bay_id,
            "can_park": True,
            "verdict": f"Accessible parking bay. Disability permit required. {_format_duration(duration)} time limit.",
            "time_limit": _format_duration(duration),
            "expires_at": _calc_expiry(arrival, duration),
            "cost_estimate": "Free with disability permit",
            "warnings": ["Disability permit must be displayed."],
            "active_restriction": active,
        }

    # General parking
    expiry = _calc_expiry(arrival, duration)
    cost = "Metered (check meter for rate)" if is_metered else "Free (no meter)"

    verdict_parts = [f"You can park here for {_format_duration(duration)}."]
    if expiry:
        verdict_parts.append(f"Your time expires at {expiry}.")
    if is_metered:
        verdict_parts.append("Payment required at the meter.")

    # Check for upcoming trap conditions during the stay
    warnings = _check_traps(windows, com_day, arrival, duration)

    if warnings:
        verdict_parts.append("Warning: restriction changes during your stay.")

    return {
        "bay_id": bay_id,
        "can_park": True,
        "verdict": " ".join(verdict_parts),
        "time_limit": _format_duration(duration),
        "expires_at": expiry,
        "cost_estimate": cost,
        "warnings": warnings,
        "active_restriction": active,
    }


def _parse_restriction_windows(record):
    """
    Parse the wide-column restriction format into a list of
    normalised window dicts.

    The CoM data stores restrictions as numbered column sets:
    fromday1, today1, starttime1, endtime1, typedesc1, duration1...
    fromday2, today2, starttime2, endtime2, typedesc2, duration2...
    """
    windows = []

    for i in range(1, 10):  # up to 9 restriction windows
        from_day_key = f"fromday{i}"
        type_key = f"typedesc{i}"

        # Stop when we hit an empty window
        if from_day_key not in record or record.get(from_day_key) is None:
            break
        if type_key not in record or record.get(type_key) is None:
            break

        type_desc = str(record.get(type_key, ""))

        # Skip "OLD" restrictions
        if type_desc.upper().endswith("OLD"):
            continue

        window = {
            "from_day": _safe_int(record.get(from_day_key)),
            "to_day": _safe_int(record.get(f"today{i}")),
            "start_time": record.get(f"starttime{i}", ""),
            "end_time": record.get(f"endtime{i}", ""),
            "type_desc": type_desc,
            "duration": _safe_int(record.get(f"duration{i}")),
            "disability_ext": _safe_int(record.get(f"disabilityext{i}")),
            "effective_on_ph": record.get(f"effectiveonph{i}"),
            "exemption": record.get(f"exemption{i}", ""),
        }

        # Convert day codes to names for readability
        if window["from_day"] is not None and window["to_day"] is not None:
            window["day_range"] = _format_day_range(window["from_day"], window["to_day"])

        windows.append(window)

    return windows


def _find_active_window(windows, com_day, arrival_time):
    """
    Find which restriction window is active for a given day and time.
    com_day: 0=Sunday, 6=Saturday (CoM convention).
    """
    for w in windows:
        from_day = w.get("from_day")
        to_day = w.get("to_day")
        start_str = w.get("start_time", "")
        end_str = w.get("end_time", "")

        if from_day is None or to_day is None:
            continue

        # Check if the day falls in range
        if not _day_in_range(com_day, from_day, to_day):
            continue

        # Check if time falls in range
        try:
            start_time = _parse_time(start_str)
            end_time = _parse_time(end_str)
        except (ValueError, TypeError):
            continue

        if start_time <= arrival_time <= end_time:
            return w

    return None


def _check_traps(windows, com_day, arrival, duration_min):
    """
    Check if any restriction changes occur during the planned stay
    that could trap the driver (clearways, tow zones, etc).

    This is the foundation for Epic 3 (Restriction Trap Detector),
    included here in basic form.
    """
    if duration_min is None:
        return []

    warnings = []
    stay_end = arrival + timedelta(minutes=duration_min)

    for w in windows:
        type_desc = w.get("type_desc", "")
        is_dangerous = any(
            kw in type_desc.upper()
            for kw in ["CLEARWAY", "CLW", "NO STOPPING", "NO PARK", "TOW"]
        )

        if not is_dangerous:
            continue

        from_day = w.get("from_day")
        to_day = w.get("to_day")
        start_str = w.get("start_time", "")

        if from_day is None or to_day is None:
            continue

        if not _day_in_range(com_day, from_day, to_day):
            continue

        try:
            restriction_starts = _parse_time(start_str)
        except (ValueError, TypeError):
            continue

        # Check if this restriction starts during our stay
        restriction_dt = arrival.replace(
            hour=restriction_starts.hour,
            minute=restriction_starts.minute,
            second=0,
        )

        if arrival < restriction_dt <= stay_end:
            warnings.append(
                f"{type_desc} begins at {start_str}. "
                f"You need to move your car before then or risk a fine/tow."
            )

    return warnings


def _day_in_range(day, from_day, to_day):
    """Check if a day falls within a range, handling week wraparound."""
    if from_day <= to_day:
        return from_day <= day <= to_day
    else:
        # Wraps around (e.g., Fri-Mon = 6,0,1)
        return day >= from_day or day <= to_day


def _format_day_range(from_day, to_day):
    """Convert day codes to readable range string."""
    if from_day == to_day:
        return DAY_NAMES[from_day]
    if from_day == 1 and to_day == 5:
        return "Monday to Friday"
    if from_day == 0 and to_day == 6:
        return "Every day"
    return f"{DAY_NAMES[from_day]} to {DAY_NAMES[to_day]}"


def _format_duration(minutes):
    """Convert minutes to a readable duration string."""
    if minutes is None:
        return "No time limit"
    if minutes < 60:
        return f"{minutes} minutes"
    hours = minutes // 60
    remaining = minutes % 60
    if remaining == 0:
        return f"{hours} hour{'s' if hours > 1 else ''}"
    return f"{hours}h {remaining}min"


def _calc_expiry(arrival, duration_min):
    """Calculate when parking expires."""
    if duration_min is None:
        return None
    expiry = arrival + timedelta(minutes=duration_min)
    return expiry.strftime("%I:%M %p")


def _parse_time(time_str):
    """Parse a time string like '07:30' or '18:30:00' into a time object."""
    from datetime import time as dt_time

    if not time_str:
        raise ValueError("Empty time string")

    parts = time_str.strip().split(":")
    hour = int(parts[0])
    minute = int(parts[1]) if len(parts) > 1 else 0
    return dt_time(hour, minute)


def _safe_int(val):
    """Safely convert a value to int, returning None on failure."""
    if val is None:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None
