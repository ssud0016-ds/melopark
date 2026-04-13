"""Temporary endpoint to verify database connectivity (remove after RDS is validated)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.db import get_db

router = APIRouter(tags=["debug"])


@router.get("/db-test")
def db_test(db: Session = Depends(get_db)) -> dict[str, str]:
    """Run SELECT 1 against the configured database."""
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "message": "Database connection successful"}
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Database connection failed: {exc}",
        ) from exc
