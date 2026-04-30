"""FastAPI application entrypoint."""

import logging
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


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: start background refresh tasks on startup."""
    from app.services.parking_service import start_background_refresh
    from app.services.restriction_lookup_service import start_background_restrictions_refresh

    from app.services.pressure_service import load_gold_data
    await start_background_refresh()
    await start_background_restrictions_refresh()
    load_gold_data()
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

