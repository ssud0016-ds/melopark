"""Repository root and data directories.

Local dev: inferred from this file under backend/app/core/ (four parents = repo root).

Production (buildpack): layout may differ from Docker; set MELOPARK_DATA_ROOT to the
directory that contains data/gold and data/silver (often the clone root, e.g. /workspace).
"""

from __future__ import annotations

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def repo_root() -> Path:
    """Root of the melopark repo (must contain data/gold and data/silver)."""
    override = os.environ.get("MELOPARK_DATA_ROOT", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return Path(__file__).resolve().parent.parent.parent.parent


def _data_subdir(name: str) -> Path:
    """Resolve data/gold or data/silver.

    Some App Platform slugs ship an empty ``data/gold`` (directory exists, no files).
    In that case we must use ``backend/data/...`` where the real parquets live.
    """
    root = repo_root()
    primary = root / "data" / name
    fallback = root / "backend" / "data" / name

    def silver_usable(p: Path) -> bool:
        return p.is_dir() and (p / "sensors_clean.parquet").exists()

    if name == "gold":

        def gold_complete(p: Path) -> bool:
            """Pressure and accessibility both need their parquet in the same gold dir."""
            if not p.is_dir():
                return False
            return (p / "epic5_zone_bay_counts.parquet").exists() and (
                p / "gold_accessibility_bays.parquet"
            ).exists()

        if gold_complete(primary):
            chosen = primary
        elif gold_complete(fallback):
            chosen = fallback
        elif (fallback / "epic5_zone_bay_counts.parquet").exists():
            chosen = fallback
        elif (primary / "epic5_zone_bay_counts.parquet").exists():
            chosen = primary
        elif fallback.is_dir():
            chosen = fallback
        elif primary.is_dir():
            chosen = primary
        else:
            chosen = fallback
        logger.info(
            "data_gold_dir=%s epic5_present=%s primary=%s fallback=%s",
            chosen,
            (chosen / "epic5_zone_bay_counts.parquet").exists(),
            primary,
            fallback,
        )
        return chosen

    if silver_usable(primary):
        return primary
    if silver_usable(fallback):
        return fallback
    if fallback.is_dir():
        return fallback
    if primary.is_dir():
        return primary
    return primary


def data_gold_dir() -> Path:
    return _data_subdir("gold")


def data_silver_dir() -> Path:
    return _data_subdir("silver")
