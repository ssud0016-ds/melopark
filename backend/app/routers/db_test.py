"""Temporary endpoint to verify database connectivity (remove after RDS is validated)."""
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from app.core.config import get_settings
from app.core.db import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["debug"])

settings = get_settings()
_is_prod = settings.ENVIRONMENT.strip().lower() == "production"


@router.get("/db-test")
def db_test(db: Session = Depends(get_db)) -> dict[str, str]:
    if _is_prod:
        raise HTTPException(status_code=404, detail="Not found")

    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "message": "Database connection successful"}
    except SQLAlchemyError as exc:
        logger.error("db-test connection failed: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Database connection failed",
        ) from exc
