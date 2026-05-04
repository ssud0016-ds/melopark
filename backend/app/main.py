"""FastAPI application entrypoint."""

import asyncio
import logging
import math
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers.accessibility import router as accessibility_router
from app.routers.bays import router as bays_router
from app.routers.db_test import router as db_test_router
from app.routers.health import router as health_router
from app.routers.parking import router as parking_router
from app.routers.pressure import router as pressure_router
from app.routers.search import router as search_router

#Rate limittinh
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address         
from slowapi.errors import RateLimitExceeded 

settings = get_settings()
logger = logging.getLogger(__name__)


def _deg2tile(lon: float, lat: float, zoom: int) -> tuple[int, int]:
    """Convert WGS84 lon/lat to slippy tile x/y at the given zoom level."""
    n = 2 ** zoom
    x = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(lat)
    y = int((1.0 - math.log(math.tan(lat_rad) + 1.0 / math.cos(lat_rad)) / math.pi) / 2.0 * n)
    return x, y


async def _prewarm_cbd_tiles() -> None:
    """Pre-compute practical Melbourne CBD tiles.

    This runs as a non-blocking background task so FastAPI startup is not
    delayed.  Controlled by MELOPARK_TILE_PREWARM env var (default "1").
    """
    from app.services.segment_tiles_service import build_tile

    zooms = [14, 15, 16]
    max_tiles = int(os.getenv("MELOPARK_TILE_PREWARM_MAX", "160"))
    # Melbourne CBD approximate bounding box
    lon_min, lat_min, lon_max, lat_max = 144.94, -37.83, 144.98, -37.81

    tiles = []
    for zoom in zooms:
        x_min, y_max = _deg2tile(lon_min, lat_min, zoom)
        x_max, y_min = _deg2tile(lon_max, lat_max, zoom)
        tiles.extend(
            (zoom, x, y)
            for x in range(x_min, x_max + 1)
            for y in range(y_min, y_max + 1)
        )
    tiles = tiles[:max_tiles]

    t0 = time.monotonic()
    logger.info("tile-prewarm: starting %d CBD tiles across z=%s", len(tiles), zooms)

    for z, x, y in tiles:
        # Yield control after each tile so the event loop stays responsive.
        await asyncio.sleep(0)
        build_tile(z, x, y)

    elapsed = time.monotonic() - t0
    logger.info("tile-prewarm: completed %d tiles in %.2fs", len(tiles), elapsed)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: start background refresh tasks on startup."""
    from app.services.parking_service import start_background_refresh
    from app.services.restriction_lookup_service import start_background_restrictions_refresh

    from app.services.pressure_service import load_gold_data
    from app.services.segment_pressure_service import load_segment_data
    await start_background_refresh()
    await start_background_restrictions_refresh()
    # Heavy parquet + geometry init: run in threads so event loop stays responsive
    # during startup (health checks, logging). Wall-clock similar unless I/O overlaps.
    await asyncio.gather(
        asyncio.to_thread(load_gold_data),
        asyncio.to_thread(load_segment_data),
    )

    # Pre-warm pressure compute cache before serving so the first manifest request
    # is a cache hit (avoids DO gateway 504 on cold start).
    if os.getenv("MELOPARK_PRESSURE_PREWARM", "1") == "1":
        from app.services.segment_pressure_service import get_pressure_by_data_version, is_loaded
        if is_loaded():
            try:
                await asyncio.to_thread(get_pressure_by_data_version)
                logger.info("pressure-prewarm: done")
            except Exception as _pw_exc:  # non-fatal — 503 is better than startup crash
                logger.warning("pressure-prewarm failed: %s", _pw_exc)

    # B8 — pre-warm CBD tiles in the background (skip when MELOPARK_TILE_PREWARM=0).
    if os.getenv("MELOPARK_TILE_PREWARM", "1") == "1":
        asyncio.create_task(_prewarm_cbd_tiles())

    yield
    # No teardown needed — background tasks are cancelled automatically by the runtime.

# Hide API docs in production so attackers cannot see our endpoint structure
is_prod = settings.ENVIRONMENT.strip().lower() == "production"

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    lifespan=lifespan,
)

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


cors_origins = settings.cors_origins_list()
allow_all = cors_origins == ["*"]

cors_origin_regex = settings.CORS_ORIGIN_REGEX.strip() or None

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=cors_origin_regex,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(db_test_router)
app.include_router(parking_router)
app.include_router(bays_router)
app.include_router(search_router)
app.include_router(accessibility_router)
app.include_router(pressure_router)

