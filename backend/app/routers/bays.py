"""Bay evaluation endpoints (Epic 2 — US 2.1, 2.2, 2.3)."""

from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.bay import BayEvaluation, BayVerdictBrief
from app.services.restriction_evaluator import evaluate_bay_at, evaluate_bays_in_bbox

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/bays", tags=["bays"])

_DEFAULT_DURATION = 60  # minutes
_MELBOURNE_TZ = ZoneInfo("Australia/Melbourne")

_ARRIVAL_ISO_QUERY_DESC = (
    "ISO-8601 arrival instant. "
    "Timezone-aware values (e.g. 2026-04-14T10:30:00+10:00, ending with Z for UTC) are preferred. "
    "If no offset is given, the time is interpreted as Australia/Melbourne local wall clock (backward compatible). "
    "Omitted: use current time in Melbourne."
)


def _parse_query_arrival_iso(arrival_iso: str) -> datetime:
    """Parse ``arrival_iso`` from evaluate query strings.

    - Aware ISO-8601: use the encoded instant (``evaluate_bay_at`` normalises to
      Melbourne naive internally).
    - Naive ISO (no offset): treat components as **Australia/Melbourne** local time
      (legacy clients).
    - Trailing ``Z`` is normalised to ``+00:00`` for ``fromisoformat`` on older
      Python versions.
    """
    s = arrival_iso.strip()
    if s.endswith("Z") or s.endswith("z"):
        s = s[:-1] + "+00:00"
    arrival = datetime.fromisoformat(s)
    if arrival.tzinfo is None:
        arrival = arrival.replace(tzinfo=_MELBOURNE_TZ)
    return arrival


@router.get(
    "/{bay_id}/evaluate",
    response_model=BayEvaluation,
    summary="Evaluate parking legality for a single bay",
)
@limiter.limit("30/minute")
def evaluate_bay(
    request: Request,
    bay_id: str,
    arrival_iso: Optional[str] = Query(
        default=None,
        description=_ARRIVAL_ISO_QUERY_DESC,
    ),
    duration_mins: int = Query(
        default=_DEFAULT_DURATION,
        ge=1,
        le=1440,
        description="Planned stay in minutes (1–1440).",
    ),
    db: Session = Depends(get_db),
) -> dict:
    """Return a yes / no / unknown verdict with a plain-English explanation.

    Serves US 2.1 (restriction lookup), US 2.2 (future arrival time), and
    US 2.3 (max stay, expiry clock, mid-stay strict-restriction warning).

    If ``arrival_iso`` is omitted the evaluation uses the current time.
    """
    arrival = datetime.now(_MELBOURNE_TZ)
    if arrival_iso is not None:
        arrival = _parse_query_arrival_iso(arrival_iso)

    return evaluate_bay_at(bay_id, arrival, duration_mins, db)


@router.get(
    "/evaluate-bulk",
    response_model=list[BayVerdictBrief],
    summary="Bulk-evaluate all bays within a bounding box",
)
@limiter.limit("15/minute")
def evaluate_bulk(
    request: Request,
    bbox: str = Query(
        ...,
        description="Bounding box as south,west,north,east (e.g. -37.82,144.95,-37.80,144.97).",
    ),
    arrival_iso: Optional[str] = Query(
        default=None,
        description=_ARRIVAL_ISO_QUERY_DESC,
    ),
    duration_mins: int = Query(
        default=_DEFAULT_DURATION,
        ge=1,
        le=1440,
        description="Planned stay in minutes.",
    ),
    db: Session = Depends(get_db),
) -> list[dict]:
    """Return ``[{bay_id, lat, lon, verdict}]`` for every bay in the viewport.

    The frontend uses this to recolour dots in a single round-trip (AC 2.2.3).
    """
    raw_parts = [p.strip() for p in bbox.split(",")]
    if len(raw_parts) != 4:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=422,
            detail="bbox must be 4 comma-separated floats: south,west,north,east",
        )
    try:
        south, west, north, east = (float(p) for p in raw_parts)
    except ValueError as exc:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=422,
            detail="bbox values must be finite floats",
        ) from exc

    arrival = datetime.now(_MELBOURNE_TZ)
    if arrival_iso is not None:
        arrival = _parse_query_arrival_iso(arrival_iso)

    return evaluate_bays_in_bbox(south, west, north, east, arrival, duration_mins, db)
