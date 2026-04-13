"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers.db_test import router as db_test_router
from app.routers.health import router as health_router
from app.routers.parking import router as parking_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: start background refresh tasks on startup."""
    from app.services.parking_service import start_background_refresh
    from app.services.restriction_lookup_service import start_background_restrictions_refresh
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
