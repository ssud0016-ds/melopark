"""SQLAlchemy sync database setup and session dependency."""

from collections.abc import Generator
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, declarative_base, sessionmaker

from app.core.config import get_settings


def _resolve_database_url(url: str) -> str:
    """Resolve relative sslrootcert query values against the backend package root."""
    parsed = urlparse(url)
    if not parsed.query:
        return url
    backend_root = Path(__file__).resolve().parent.parent.parent
    pairs: list[tuple[str, str]] = []
    changed = False
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if key == "sslrootcert" and value and not Path(value).is_absolute():
            cert_path = (backend_root / value.lstrip("./\\")).resolve()
            pairs.append((key, cert_path.as_posix()))
            changed = True
        else:
            pairs.append((key, value))
    if not changed:
        return url
    new_query = urlencode(pairs)
    return urlunparse(
        (
            parsed.scheme,
            parsed.netloc,
            parsed.path,
            parsed.params,
            new_query,
            parsed.fragment,
        )
    )


settings = get_settings()
database_url = _resolve_database_url(settings.DATABASE_URL)

def _engine_connect_args(url: str) -> dict:
    """Return driver-specific connect args.

    Local dev often runs without Postgres; fail fast instead of hanging requests.
    """
    parsed = urlparse(url)
    if parsed.scheme.startswith("postgresql"):
        return {"connect_timeout": 2}
    return {}

engine = create_engine(
    database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args=_engine_connect_args(database_url),
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Yield a DB session and always close it afterwards."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

