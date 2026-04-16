"""FastAPI application entrypoint."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers.bays import router as bays_router
from app.routers.db_test import router as db_test_router
from app.routers.health import router as health_router
from app.routers.parking import router as parking_router
from app.routers.search import router as search_router

settings = get_settings()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: start background refresh tasks on startup."""
    from app.services.parking_service import start_background_refresh
    from app.services.restriction_lookup_service import start_background_restrictions_refresh

    # Lambda has no persistent process — background loops never keep a warm cache.
    # Parking is served via on-demand refresh in parking_service.fetch_raw_parking_bays().
    if os.getenv("AWS_LAMBDA_FUNCTION_NAME"):
        logger.info(
            "AWS Lambda detected: skipping CoM background refresh tasks "
            "(parking uses on-demand sensor fetch; restrictions cache may stay cold until extended)."
        )
    else:
        await start_background_refresh()
        await start_background_restrictions_refresh()
    yield
    # No teardown needed — background tasks are cancelled automatically by the runtime.


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

cors_origins = settings.cors_origins_list()
allow_all = cors_origins == ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=not allow_all,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router)
app.include_router(db_test_router)
app.include_router(parking_router)
app.include_router(bays_router)
app.include_router(search_router)
