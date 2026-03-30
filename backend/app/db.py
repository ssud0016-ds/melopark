"""
Database module for the backend.

Creates a SQLAlchemy engine from the DATABASE_URL environment variable and
provides a get_connection() helper that other modules can import.
"""

import os
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy import text
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError

_ENGINE: Optional[Engine] = None


def get_connection() -> Optional[Engine]:
    """
    Return a cached SQLAlchemy engine created from DATABASE_URL.

    Returns None if DATABASE_URL is missing or the engine can't connect.
    """
    global _ENGINE

    if _ENGINE is not None:
        return _ENGINE

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("[db] DATABASE_URL not set")
        return None

    try:
        # pool_pre_ping helps avoid stale connections in long-running dev servers.
        engine = create_engine(database_url, pool_pre_ping=True)

        # Validate connection once so we fail fast and can gracefully fall back.
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))

        _ENGINE = engine
        return _ENGINE
    except SQLAlchemyError as e:
        print(f"[db] Could not connect to database: {e}")
        _ENGINE = None
        return None

