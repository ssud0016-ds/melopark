"""Evaluate whether a bay is legal to park in at an arbitrary future time.

This module is the core of Epic 2 (US 2.1 / 2.2 / 2.3).  It queries the
``bays`` and ``bay_restrictions`` tables that ``build_gold.py`` populates, and
computes a per-request verdict — verdicts are never pre-computed because the
arrival time is user input.

Public API
----------
    evaluate_bay_at(bay_id, arrival, duration_mins, db) -> dict
"""

from __future__ import annotations

import logging
from datetime import datetime, time, timedelta
from typing import Optional, Tuple
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.models.bay import Bay, BayRestriction

logger = logging.getLogger(__name__)
_MELBOURNE_TZ = ZoneInfo("Australia/Melbourne")


_COM_DAY_NAMES = {
    0: "Sunday",
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
}

# Priority order: lower number = stricter.  When multiple restrictions are
# active simultaneously the most restrictive one governs the verdict.
_CATEGORY_PRIORITY: dict[str, int] = {
    "clearway": 0,
    "no_standing": 1,
    "loading": 2,
    "disabled": 3,
    "timed": 4,
    # Unmetered / no-payment windows from classify_rule() (FREE, P FREE, …).
    "free": 5,
    "other": 6,
}

_SIGNAGE_MESSAGE = (
    "We don't have restriction data for this bay. "
    "Please check the physical signage on site before parking."
)

_NO_DATA_RESULT_TEMPLATE = {
    "verdict": "unknown",
    "reason": _SIGNAGE_MESSAGE,
    "active_restriction": None,
    "warning": None,
    "data_source": "unknown",
    "data_coverage": "none",
}


# ── External-API fallback ────────────────────────────────────────────────────

def _evaluate_from_bay_type(bay_id: str, bay_type: str) -> dict:
    """Construct a BayEvaluation from the CoM restriction API's bay_type tag.

    Called when the bay is not in the DB (or has no restriction rows) but the
    external restriction API cache has a bay_type string.  The result is less
    precise than a DB-backed evaluation (no time windows), but it is real data,
    not frontend guesswork.

    Marked ``data_source = "api_fallback"`` so the frontend can display a note.
    """
    base: dict = {
        "bay_id": bay_id,
        "warning": None,
        "data_source": "api_fallback",
        # Tier-2 fallback answers with rules but never has live sensor status.
        "data_coverage": "rules_only",
    }

    if bay_type == "Loading Zone":
        return {
            **base,
            "verdict": "no",
            "reason": (
                "Loading zone — passenger vehicles cannot stop here during posted hours. "
                "Check on-site signage for exact times."
            ),
            "active_restriction": {
                "typedesc": "Loading Zone",
                "rule_category": "loading",
                "plain_english": "Loading zone restriction. Verify hours on posted street signage.",
                "max_stay_mins": None,
                "expires_at": None,
            },
        }

    if bay_type == "No Standing":
        return {
            **base,
            "verdict": "no",
            "reason": (
                "No standing — vehicles may not stop or wait here during posted hours. "
                "Check on-site signage for exact times."
            ),
            "active_restriction": {
                "typedesc": "No Standing",
                "rule_category": "no_standing",
                "plain_english": "No standing restriction. Verify hours on posted street signage.",
                "max_stay_mins": None,
                "expires_at": None,
            },
        }

    if bay_type == "Disabled":
        return {
            **base,
            "verdict": "no",
            "reason": "Disability permit required — this bay is reserved for vehicles displaying a valid permit.",
            "active_restriction": {
                "typedesc": "Disabled Parking",
                "rule_category": "disabled",
                "plain_english": "Disability permit required. Verify hours on posted street signage.",
                "max_stay_mins": None,
                "expires_at": None,
            },
        }

    # "Timed" guessing retired 2026-04 — metered bays not in the DB fall
    # through to the "unknown — check signage" template below rather than
    # returning a string-match guess.  See restriction_lookup_service._map_type_desc.

    # "Other" or anything unrecognised
    return {**base, **_NO_DATA_RESULT_TEMPLATE, "bay_id": bay_id}


# ── Day / time helpers ──────────────────────────────────────────────────────

def _to_com_day(dt: datetime) -> int:
    """Convert a Python datetime to CoM day convention (0=Sun 1=Mon … 6=Sat)."""
    iso = dt.isoweekday()  # 1=Mon … 7=Sun
    return 0 if iso == 7 else iso


def _day_in_range(com_day: int, fromday: int, today: int) -> bool:
    """True if *com_day* falls within [fromday, today], handling wrap-around.

    The existing ``is_active_now()`` in build_gold.py does a naïve
    ``from_d <= com_day <= to_d`` which silently fails for ranges like
    SAT–SUN (6→0).  This version handles wrap-around correctly.
    """
    if fromday <= today:
        return fromday <= com_day <= today
    # wrap-around: e.g. SAT(6)–SUN(0)
    return com_day >= fromday or com_day <= today


def _time_to_minutes(t: time) -> int:
    return t.hour * 60 + t.minute


def _normalise_arrival_to_melbourne_naive(arrival: datetime) -> datetime:
    """Convert tz-aware arrivals to Melbourne local naive datetime.

    Downstream restriction logic compares naive datetime fields against DB times,
    so we normalise only at boundaries and leave internal evaluation unchanged.
    """
    if arrival.tzinfo is None:
        return arrival
    return arrival.astimezone(_MELBOURNE_TZ).replace(tzinfo=None)


def _to_melbourne_iso(dt: datetime) -> str:
    """Serialize naive Melbourne-local datetime with explicit Melbourne offset."""
    return dt.replace(tzinfo=_MELBOURNE_TZ).isoformat()

def _format_clock(t: time) -> str:
    """Format a time as '7:30 AM' in Melbourne locale."""
    dt = datetime(2000, 1, 1, t.hour, t.minute, tzinfo=_MELBOURNE_TZ)
    # %-I isn't portable on Windows; use strftime then normalise.
    s = dt.strftime("%I:%M %p")
    return s.lstrip("0").replace("  ", " ")


def _format_day_range(fromday: int, today: int) -> str:
    if fromday == today:
        return _COM_DAY_NAMES.get(fromday, "Day")
    return f"{_COM_DAY_NAMES.get(fromday, 'Day')} to {_COM_DAY_NAMES.get(today, 'Day')}"


def _build_translator_rules(
    restrictions: list[BayRestriction],
    arrival: datetime,
    governing: Optional[BayRestriction],
    warning: Optional[dict],
) -> list[dict]:
    """Build the Parking Sign Translator list from DB restriction rows.

    Returns a list of dicts matching schemas.bay.TranslatorRule.
    """
    items: list[dict] = []

    # Sort stable by slot_num (pipeline semantics) then time.
    sorted_rows = sorted(
        restrictions,
        key=lambda r: (getattr(r, "slot_num", 0), _time_to_minutes(r.starttime), _time_to_minutes(r.endtime)),
    )

    warning_id = None
    if warning:
        # Find the BayRestriction row that produced the warning (best-effort match).
        for r in sorted_rows:
            if r.is_strict and r.rule_category == warning.get("type") and r.typedesc == warning.get("typedesc"):
                warning_id = getattr(r, "id", None)
                break

    for r in sorted_rows:
        heading = f"{_format_day_range(r.fromday, r.today)} from {_format_clock(r.starttime)} to {_format_clock(r.endtime)}"
        state: str = "normal"
        banner: Optional[str] = None

        if governing is not None and getattr(r, "id", None) == getattr(governing, "id", None):
            state = "current"
            banner = "THIS RULE IS CURRENTLY IN EFFECT"
        elif warning and warning_id is not None and getattr(r, "id", None) == warning_id:
            state = "upcoming"
            mins = int(warning.get("minutes_into_stay") or 0)
            if mins >= 60 and mins % 60 == 0:
                h = mins // 60
                banner = f"THIS RULE WILL BE IN EFFECT IN {h} HOUR" if h == 1 else f"THIS RULE WILL BE IN EFFECT IN {h} HOURS"
            elif mins >= 60:
                h = mins // 60
                m = mins % 60
                banner = f"THIS RULE WILL BE IN EFFECT IN {h}H {m}M"
            else:
                banner = f"THIS RULE WILL BE IN EFFECT IN {mins} MIN"

        items.append(
            {
                "state": state,
                "heading": heading,
                "body": r.plain_english,
                "banner": banner,
            }
        )

    # Always include the outside-times card to match the UI.
    items.append(
        {
            "state": "outside",
            "heading": "Outside all these times (nights, public holidays)",
            "body": "You're free to park with no limit and no payment.",
            "banner": None,
        }
    )
    return items

def _effective_end_mins(start: time, end: time, fromday: int, today: int) -> int:
    """Return the active-window end as minutes-from-midnight.

    Treat an ``end`` of ``00:00`` as end-of-day (1440) when the row is a
    wrap-day rule (``fromday != today``) or when ``end < start`` — both of
    these signal "midnight = end of window", which CoM represents literally
    as ``00:00``.  Plain same-day rules with ``end = 00:00`` are meaningless
    and still return 0 so they correctly match nothing.
    """
    start_mins = _time_to_minutes(start)
    end_mins = _time_to_minutes(end)
    if end_mins == 0 and (fromday != today or start_mins > 0):
        return 1440
    if end_mins < start_mins:
        return 1440
    return end_mins


# ── Single-restriction helpers ──────────────────────────────────────────────

def is_restriction_active_at(r: BayRestriction, dt: datetime) -> bool:
    """Return True if restriction *r* is active at datetime *dt*."""
    com_day = _to_com_day(dt)
    if not _day_in_range(com_day, r.fromday, r.today):
        return False
    now_mins = dt.hour * 60 + dt.minute
    start_mins = _time_to_minutes(r.starttime)
    end_mins = _effective_end_mins(r.starttime, r.endtime, r.fromday, r.today)
    return start_mins <= now_mins < end_mins


def _find_strict_starting_during_stay(
    restrictions: list[BayRestriction],
    arrival: datetime,
    duration_mins: int,
) -> Optional[dict]:
    """Return the earliest strict restriction whose window *begins* during the stay.

    "Begins during the stay" means the restriction's daily start time falls
    strictly after *arrival* and on-or-before *arrival + duration_mins*, on a
    day that is within the restriction's day range.

    Handles stays that span midnight (up to ~24 h).
    """
    end_dt = arrival + timedelta(minutes=duration_mins)
    earliest: Optional[Tuple[datetime, BayRestriction]] = None

    for r in restrictions:
        if not r.is_strict:
            continue

        # Walk each calendar day the stay covers.
        day_cursor = arrival.replace(hour=0, minute=0, second=0, microsecond=0)
        while day_cursor.date() <= end_dt.date():
            com_day = _to_com_day(day_cursor)
            if _day_in_range(com_day, r.fromday, r.today):
                r_start_dt = day_cursor.replace(
                    hour=r.starttime.hour,
                    minute=r.starttime.minute,
                    second=0,
                    microsecond=0,
                )
                if arrival < r_start_dt <= end_dt:
                    if earliest is None or r_start_dt < earliest[0]:
                        earliest = (r_start_dt, r)
            day_cursor += timedelta(days=1)

    if earliest is None:
        return None

    starts_at, r = earliest
    return {
        "type": r.rule_category,
        "typedesc": r.typedesc,
        "starts_at": _to_melbourne_iso(starts_at),
        "minutes_into_stay": int((starts_at - arrival).total_seconds() / 60),
        "description": r.plain_english,
    }


def _reason_when_no_restriction_active_at_arrival(
    restrictions: list[BayRestriction],
) -> str:
    """Copy for when no rule window applies at arrival (governing is None).

    Avoid claiming unconditional \"free of charge\" where the bay is normally
    metered/timed — only outside those hours.
    """
    has_timed = any(
        getattr(r, "rule_category", None) == "timed" for r in restrictions
    )
    if has_timed:
        return (
            "No timed or meter restriction applies at your arrival time. "
            "You may park during this window without paying at a meter, based on our data. "
            "Always confirm payment rules on posted signage."
        )
    return (
        "No restrictions apply at your arrival time. You may park here. "
        "Check posted signage to confirm."
    )


# ── Verdict logic ───────────────────────────────────────────────────────────

def _pick_governing_restriction(
    active: list[BayRestriction],
) -> Optional[BayRestriction]:
    """From all restrictions active at the arrival moment, return the strictest."""
    if not active:
        return None
    return min(active, key=lambda r: _CATEGORY_PRIORITY.get(r.rule_category, 99))


def _verdict_for_restriction(
    r: BayRestriction,
    arrival: datetime,
    duration_mins: int,
) -> Tuple[str, str, Optional[int], Optional[str]]:
    """Return (verdict, reason, max_stay_mins, expires_at_iso) for a single active rule."""
    cat = r.rule_category

    if cat in ("clearway", "no_standing"):
        return (
            "no",
            f"No stopping allowed during these hours. {r.plain_english}",
            None,
            None,
        )

    if cat == "loading":
        return (
            "no",
            f"Loading zone only — passenger vehicles cannot park here. {r.plain_english}",
            None,
            None,
        )

    if cat == "disabled":
        return (
            "no",
            "This bay requires a valid disability parking permit. "
            + r.plain_english,
            None,
            None,
        )

    if cat == "timed":
        max_stay = r.duration_mins
        if max_stay is None:
            return (
                "yes",
                f"Timed parking with no stated limit. {r.plain_english}",
                None,
                None,
            )
        expires_at = _to_melbourne_iso(arrival + timedelta(minutes=max_stay))
        if duration_mins <= max_stay:
            return (
                "yes",
                r.plain_english,
                max_stay,
                expires_at,
            )
        return (
            "no",
            f"You plan to stay {duration_mins} min but the limit is {max_stay} min. "
            + r.plain_english,
            max_stay,
            expires_at,
        )

    # Free / unmetered parking windows (build_gold classify_rule → rule_category "free").
    # Must not fall through to "other", which incorrectly returns verdict "no".
    if cat == "free":
        max_stay = r.duration_mins
        if max_stay is None:
            return ("yes", r.plain_english, None, None)
        expires_at = _to_melbourne_iso(arrival + timedelta(minutes=max_stay))
        if duration_mins <= max_stay:
            return ("yes", r.plain_english, max_stay, expires_at)
        return (
            "no",
            f"You plan to stay {duration_mins} min but the limit is {max_stay} min. "
            + r.plain_english,
            max_stay,
            expires_at,
        )

    # "other" (bus, taxi, permit, etc.)
    return (
        "no",
        f"Special restriction applies. {r.plain_english}",
        None,
        None,
    )


# ── Public API ──────────────────────────────────────────────────────────────

def evaluate_bay_at(
    bay_id: str,
    arrival: datetime,
    duration_mins: int,
    db: Session,
) -> dict:
    """Evaluate whether parking at *bay_id* is legal at *arrival* for *duration_mins*.

    Returns a dict matching the ``BayEvaluation`` Pydantic schema.

    Evaluation priority:
      1. DB (RDS bays + bay_restrictions tables) — full time-window logic.
      2. External CoM restriction API cache (bay_type string) — coarser fallback.
      3. Neither source has data → verdict "unknown", instruct user to check signage.

    ``data_source`` in the response tells the frontend which tier answered:
      "db"           – answered from the RDS restriction tables (most precise)
      "api_fallback" – answered from the CoM API cache (real data, coarser)
      "unknown"      – no usable data from either source
    """
    from app.services.restriction_lookup_service import get_cached_bay_type

    arrival = _normalise_arrival_to_melbourne_naive(arrival)

    # ── Tier 1: DB lookup ────────────────────────────────────────────────
    bay = db.query(Bay).filter(Bay.bay_id == bay_id).first()

    # Resolve street_name from the bays table (populated by build_gold pipeline).
    db_street_name = getattr(bay, "street_name", None) if bay is not None else None

    if bay is not None and bay.has_restriction_data:
        restrictions = (
            db.query(BayRestriction)
            .filter(BayRestriction.bay_id == bay_id)
            .all()
        )
        if restrictions:
            has_signage_gap = getattr(bay, "has_signage_gap", False) or False
            result = _evaluate_from_db(bay_id, restrictions, arrival, duration_mins, has_signage_gap)
            result["street_name"] = db_street_name
            return result

    # ── Tier 2: external API cache fallback ──────────────────────────────
    if bay is None:
        return {
            "bay_id": bay_id,
            "verdict": "unknown",
            "reason": "Bay not found in our database. Check signage on site before parking.",
            "active_restriction": None,
            "warning": None,
            "data_source": "unknown",
            "data_coverage": "none",
            "street_name": None,
        }

    logger.debug(
        "Bay %s not in DB or has no restriction rows — trying API cache fallback.",
        bay_id,
    )
    bay_type = get_cached_bay_type(bay_id)
    if bay_type and bay_type != "Other":
        logger.debug("Bay %s: API fallback using bay_type=%r", bay_id, bay_type)
        result = _evaluate_from_bay_type(bay_id, bay_type)
        result["street_name"] = db_street_name
        return result

    # ── Tier 3: no data ──────────────────────────────────────────────────
    return {"bay_id": bay_id, **_NO_DATA_RESULT_TEMPLATE, "street_name": db_street_name}


def _evaluate_from_db(
    bay_id: str,
    restrictions: list[BayRestriction],
    arrival: datetime,
    duration_mins: int,
    has_signage_gap: bool = False,
) -> dict:
    """Run the full time-window evaluation against DB restriction rows."""
    from app.services.parking_service import has_live_sensor

    active = [r for r in restrictions if is_restriction_active_at(r, arrival)]
    governing = _pick_governing_restriction(active)

    # "full"            = live sensor present
    # "partial_signage" = bay on LZ/DP-touched zone but plate not in DB
    # "rules_only"      = DB verdict, no live sensor
    if has_signage_gap:
        data_coverage = "partial_signage"
    elif has_live_sensor(bay_id):
        data_coverage = "full"
    else:
        data_coverage = "rules_only"

    if governing is None:
        # Outside all restriction windows — legal at this moment; wording
        # distinguishes metered bays outside paid hours from truly unrestricted bays.
        warning = _find_strict_starting_during_stay(restrictions, arrival, duration_mins)
        return {
            "bay_id": bay_id,
            "verdict": "yes",
            "reason": _reason_when_no_restriction_active_at_arrival(restrictions),
            "active_restriction": None,
            "warning": warning,
            "data_source": "db",
            "data_coverage": data_coverage,
            "translator_rules": _build_translator_rules(restrictions, arrival, None, warning),

        }

    verdict, reason, max_stay, expires_at = _verdict_for_restriction(
        governing, arrival, duration_mins,
    )

    active_restriction = {
        "typedesc": governing.typedesc,
        "rule_category": governing.rule_category,
        "plain_english": governing.plain_english,
        "max_stay_mins": max_stay,
        "expires_at": expires_at,
    }

    warning = None
    if verdict == "yes":
        warning = _find_strict_starting_during_stay(restrictions, arrival, duration_mins)

    return {
        "bay_id": bay_id,
        "verdict": verdict,
        "reason": reason,
        "active_restriction": active_restriction,
        "warning": warning,
        "data_source": "db",
        "data_coverage": data_coverage,
        "translator_rules": _build_translator_rules(restrictions, arrival, governing, warning),

    }


def evaluate_bays_bulk(
    bay_ids: list[str],
    arrival: datetime,
    duration_mins: int,
    db: Session,
) -> list[dict]:
    """Lightweight bulk evaluation — returns only bay_id + verdict + lat/lon.

    Used by the frontend to recolour map dots in a single round-trip.

    Matches :func:`evaluate_bay_at` tiers: DB rows when present; otherwise the
    same CoM API cache fallback (``bay_type``) used for single-bay evaluation.
    """
    from app.services.restriction_lookup_service import get_cached_bay_type

    arrival = _normalise_arrival_to_melbourne_naive(arrival)

    # Defensive: drop NULL-geometry bays from bulk/map responses — they can't
    # render as markers.  NULL-geom bays are still addressable via
    # evaluate_bay_at for shareable/bookmarked URLs.
    bays = (
        db.query(Bay)
        .filter(
            Bay.bay_id.in_(bay_ids),
            Bay.lat.isnot(None),
            Bay.lon.isnot(None),
        )
        .all()
    )
    bay_map = {b.bay_id: b for b in bays}

    restrictions = (
        db.query(BayRestriction)
        .filter(BayRestriction.bay_id.in_(bay_ids))
        .all()
    )
    rest_by_bay: dict[str, list[BayRestriction]] = {}
    for r in restrictions:
        rest_by_bay.setdefault(r.bay_id, []).append(r)

    results = []
    for bid in bay_ids:
        bay = bay_map.get(bid)
        if bay is None:
            continue

        bay_rest = rest_by_bay.get(bid, [])

        if bay.has_restriction_data and bay_rest:
            active = [r for r in bay_rest if is_restriction_active_at(r, arrival)]
            governing = _pick_governing_restriction(active)

            sn = getattr(bay, "street_name", None)

            if governing is None:
                results.append({"bay_id": bid, "lat": bay.lat, "lon": bay.lon, "verdict": "yes", "street_name": sn})
                continue

            verdict, _, _, _ = _verdict_for_restriction(governing, arrival, duration_mins)
            results.append({"bay_id": bid, "lat": bay.lat, "lon": bay.lon, "verdict": verdict, "street_name": sn})
            continue

        # Same fallback as evaluate_bay_at when DB has no restriction rows.
        sn = getattr(bay, "street_name", None)
        bay_type = get_cached_bay_type(bid)
        if bay_type and bay_type != "Other":
            ev = _evaluate_from_bay_type(bid, bay_type)
            results.append(
                {
                    "bay_id": bid,
                    "lat": bay.lat,
                    "lon": bay.lon,
                    "verdict": ev["verdict"],
                    "street_name": sn,
                }
            )
        else:
            results.append({"bay_id": bid, "lat": bay.lat, "lon": bay.lon, "verdict": "unknown", "street_name": sn})

    return results


def evaluate_bays_in_bbox(
    south: float,
    west: float,
    north: float,
    east: float,
    arrival: datetime,
    duration_mins: int,
    db: Session,
) -> list[dict]:
    """Evaluate all bays within a bounding box."""
    bays = (
        db.query(Bay)
        .filter(
            Bay.lat >= south,
            Bay.lat <= north,
            Bay.lon >= west,
            Bay.lon <= east,
            # Defensive: range filter above already excludes NULLs (a NULL
            # comparison evaluates to NULL, which is falsy in WHERE), but
            # explicit is clearer for future readers.
            Bay.lat.isnot(None),
            Bay.lon.isnot(None),
        )
        .all()
    )
    if not bays:
        return []

    bay_ids = [b.bay_id for b in bays]
    return evaluate_bays_bulk(bay_ids, arrival, duration_mins, db)
