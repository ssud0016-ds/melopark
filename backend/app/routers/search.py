"""Search endpoints backed by the search_index table."""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import get_db

from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("", summary="Search addresses, streets, and landmarks")
@limiter.limit("30/minute")
def search_places(
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
    pattern = f"%{q}%"
    prefix = f"{q}%"

    stmt = text(
        """
        SELECT name, sub, category, lat, lng
        FROM search_index
        WHERE lower(name) LIKE lower(:pattern)
           OR lower(COALESCE(sub, '')) LIKE lower(:pattern)
        ORDER BY
            CASE category
                WHEN 'landmark' THEN 0
                WHEN 'street' THEN 1
                WHEN 'address' THEN 2
                ELSE 3
            END,
            CASE WHEN lower(name) LIKE lower(:prefix) THEN 0 ELSE 1 END,
            length(name)
        LIMIT :limit
        """
    )

    try:
        rows = db.execute(stmt, {"pattern": pattern, "prefix": prefix, "limit": limit}).mappings().all()
    except SQLAlchemyError as exc:
        settings = get_settings()
        detail = (
            "Search index is not available yet. Create the table (see docs/search_index_schema.sql) "
            "and load data (e.g. python scripts/load_search_index.py). "
        )
        if settings.ENVIRONMENT.strip().lower() == "development":
            detail += f"DB error: {exc.__class__.__name__}: {exc}"
        raise HTTPException(status_code=503, detail=detail) from exc

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
