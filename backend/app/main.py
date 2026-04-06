"""FastAPI application entrypoint."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers.health import router as health_router

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=settings.APP_DESCRIPTION,
    docs_url="/docs",
    redoc_url="/redoc",
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

