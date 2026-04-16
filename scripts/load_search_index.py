"""
Load data/gold/search_index.csv into Postgres table ``search_index``.

Uses DATABASE_URL from backend/.env (same as build_gold.py --write-db).

Usage (from repo root):
    python scripts/load_search_index.py
    python scripts/load_search_index.py --csv path/to/search_index.csv
"""

from __future__ import annotations

import argparse
import logging
import os
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy import create_engine, text

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger("load_search_index")

ROOT = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT / "backend"
GOLD_DIR = ROOT / "data" / "gold"
SCHEMA_PATH = ROOT / "docs" / "search_index_schema.sql"
DEFAULT_CSV = GOLD_DIR / "search_index.csv"


def _resolve_database_url(url: str) -> str:
    """Resolve relative sslrootcert paths against the backend directory."""
    parsed = urlparse(url)
    if not parsed.query:
        return url
    pairs: list[tuple[str, str]] = []
    changed = False
    for key, value in parse_qsl(parsed.query, keep_blank_values=True):
        if key == "sslrootcert" and value and not Path(value).is_absolute():
            cert_path = (BACKEND_DIR / value.lstrip("./\\")).resolve()
            pairs.append((key, cert_path.as_posix()))
            changed = True
        else:
            pairs.append((key, value))
    if not changed:
        return url
    new_query = urlencode(pairs)
    return urlunparse(
        (parsed.scheme, parsed.netloc, parsed.path, parsed.params, new_query, parsed.fragment),
    )


def _executable_sql_chunk(raw: str) -> str | None:
    """Drop blank lines and full-line ``--`` comments so chunks are real SQL (not skipped as 'comment-only')."""
    lines_out: list[str] = []
    for line in raw.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("--"):
            continue
        lines_out.append(line)
    text = "\n".join(lines_out).strip()
    return text if text else None


def _database_url() -> str:
    from dotenv import load_dotenv

    env_path = BACKEND_DIR / ".env"
    if env_path.exists():
        load_dotenv(env_path)
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL not set. Create backend/.env (see backend/.env.example)."
        )
    return _resolve_database_url(url)


def main() -> None:
    parser = argparse.ArgumentParser(description="Load search_index.csv into Postgres")
    parser.add_argument(
        "--csv",
        type=Path,
        default=DEFAULT_CSV,
        help=f"Path to CSV (default: {DEFAULT_CSV})",
    )
    args = parser.parse_args()

    if not args.csv.exists():
        raise FileNotFoundError(
            f"CSV not found: {args.csv}\n"
            "Run: python scripts/build_gold.py --search-only --export-csv"
        )

    import pandas as pd

    url = _database_url()
    engine = create_engine(url, pool_pre_ping=True)

    df = pd.read_csv(args.csv)
    cols = ["name", "sub", "category", "lat", "lng"]
    missing = [c for c in cols if c not in df.columns]
    if missing:
        raise ValueError(f"CSV missing columns: {missing}")

    df = df[cols].copy()
    # Normalise sub for NOT NULL if DB expects empty string
    if "sub" in df.columns:
        df["sub"] = df["sub"].fillna("").astype(str)

    with engine.begin() as conn:
        if SCHEMA_PATH.exists():
            schema_sql = SCHEMA_PATH.read_text(encoding="utf-8")
            for part in schema_sql.split(";"):
                stmt = _executable_sql_chunk(part)
                if stmt:
                    conn.execute(text(stmt))
        conn.execute(text("TRUNCATE search_index RESTART IDENTITY"))

    df.to_sql("search_index", engine, if_exists="append", index=False, method="multi", chunksize=500)
    log.info("Loaded %d rows into search_index", len(df))


if __name__ == "__main__":
    main()
