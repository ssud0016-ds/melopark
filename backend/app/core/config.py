"""Application settings loaded from environment variables."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings for FastAPI and infrastructure connections."""

    APP_NAME: str = "MelOPark API"
    APP_VERSION: str = "0.1.0"
    APP_DESCRIPTION: str = "Backend API for Melbourne parking data."

    ENVIRONMENT: str = "development"
    DATABASE_URL: str = "postgresql://user:pass@localhost:5432/melopark"
    
    # Comma-separated list, e.g. "http://localhost:5173,https://your.vercel.app"
    CORS_ORIGINS: str = "*"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    def cors_origins_list(self) -> list[str]:
        """Return CORS origins as a normalized list."""
        if self.CORS_ORIGINS.strip() == "*":
            return ["*"]
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    """Return a cached settings instance."""
    return Settings()

