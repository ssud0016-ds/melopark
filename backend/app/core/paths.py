"""Repository root and data directories.

Local dev: inferred from this file under backend/app/core/ (four parents = repo root).

Production (buildpack): layout may differ from Docker; set MELOPARK_DATA_ROOT to the
directory that contains data/gold and data/silver (often the clone root, e.g. /workspace).
"""

from __future__ import annotations

import os
from pathlib import Path


def repo_root() -> Path:
    """Root of the melopark repo (must contain data/gold and data/silver)."""
    override = os.environ.get("MELOPARK_DATA_ROOT", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return Path(__file__).resolve().parent.parent.parent.parent


def data_gold_dir() -> Path:
    return repo_root() / "data" / "gold"


def data_silver_dir() -> Path:
    return repo_root() / "data" / "silver"
