"""Search endpoints backed by the search_index table."""

import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db

from slowapi import Limiter
from slowapi.util import get_remote_address
logger = logging.getLogger(__name__)
limiter = Limiter(key_func=get_remote_address)

def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", summary="Search addresses, streets, and landmarks")
@limiter.limit("30/minute")
def search_places(
    request: Request,
    q: str = Query(..., min_length=2, max_length=100, description="Free-text query"),
    limit: int = Query(8, ge=1, le=20, description="Maximum number of rows"),
    db: Session = Depends(get_db),
):
    """
    Return best-matching search rows from search_index.

    Ranking:
      1. landmark before street before address
      2. prefix matches before contains matches
      3. shorter names before longer names
    """
    escaped_q = _escape_like(q)
    pattern = f"%{escaped_q}%"
    prefix = f"{escaped_q}%"

    stmt = text(
        """
        SELECT name, sub, category, lat, lng
        FROM search_index
        WHERE lower(name) LIKE lower(:pattern) ESCAPE '\\'
           OR lower(COALESCE(sub, '')) LIKE lower(:pattern) ESCAPE '\\'
        ORDER BY
            CASE category
                WHEN 'landmark' THEN 0
                WHEN 'street' THEN 1
                WHEN 'address' THEN 2
                ELSE 3
            END,
            CASE WHEN lower(name) LIKE lower(:prefix) ESCAPE '\\' THEN 0 ELSE 1 END,
            length(name)
        LIMIT :limit
        """
    )

    try:
        rows = db.execute(stmt, {"pattern": pattern, "prefix": prefix, "limit": limit}).mappings().all()
    except SQLAlchemyError as exc:
        # Log the full error server-side for debugging; never send it to clients.
        logger.error("Search query failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail=(
                "Search index is not available yet. Create the table "
                "(see docs/search_index_schema.sql) and load data "
                "(e.g. python scripts/load_search_index.py)."
            ),
        ) from exc

    return [
        {
            "name": row["name"],
            "sub": row["sub"],
            "category": row["category"],
            "lat": row["lat"],
            "lng": row["lng"],
        }
        for row in rows
    ]