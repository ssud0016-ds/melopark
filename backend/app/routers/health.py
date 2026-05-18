"""Health router for service readiness checks."""

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.config import Settings, get_settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    """Health response payload."""

    status: str
    environment: str


@router.get("/health", response_model=HealthResponse)
def health_check(settings: Settings = Depends(get_settings)) -> HealthResponse:
    env = settings.ENVIRONMENT
    if env.strip().lower() == "production":
        env = "live"
    return HealthResponse(status="ok", environment=env)
