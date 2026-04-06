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
    """Return service health and runtime environment."""
    return HealthResponse(status="ok", environment=settings.ENVIRONMENT)

