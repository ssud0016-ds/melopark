"""Bay evaluation endpoints (Epic 2 — US 2.1, 2.2, 2.3)."""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.schemas.bay import BayEvaluation, BayVerdictBrief
from app.services.restriction_evaluator import evaluate_bay_at, evaluate_bays_in_bbox

from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/bays", tags=["bays"])

_DEFAULT_DURATION = 60  # minutes


@router.get(
    "/{bay_id}/evaluate",
    response_model=BayEvaluation,
    summary="Evaluate parking legality for a single bay",
)
@limiter.limit("30/minute")
def evaluate_bay(
    bay_id: str,
    arrival_iso: Optional[str] = Query(
        default=None,
        description="ISO-8601 arrival time (e.g. 2026-04-14T10:30:00). Defaults to now.",
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
    arrival = datetime.now()
    if arrival_iso is not None:
        arrival = datetime.fromisoformat(arrival_iso)

    return evaluate_bay_at(bay_id, arrival, duration_mins, db)


@router.get(
    "/evaluate-bulk",
    response_model=list[BayVerdictBrief],
    summary="Bulk-evaluate all bays within a bounding box",
)
@limiter.limit("15/minute")
def evaluate_bulk(
    bbox: str = Query(
        ...,
        description="Bounding box as south,west,north,east (e.g. -37.82,144.95,-37.80,144.97).",
    ),
    arrival_iso: Optional[str] = Query(
        default=None,
        description="ISO-8601 arrival time. Defaults to now.",
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
    parts = [float(p.strip()) for p in bbox.split(",")]
    if len(parts) != 4:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=422,
            detail="bbox must be 4 comma-separated floats: south,west,north,east",
        )
    south, west, north, east = parts

    arrival = datetime.now()
    if arrival_iso is not None:
        arrival = datetime.fromisoformat(arrival_iso)

    return evaluate_bays_in_bbox(south, west, north, east, arrival, duration_mins, db)
