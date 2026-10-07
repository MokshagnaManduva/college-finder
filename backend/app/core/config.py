from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import make_url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env", extra="ignore"
    )

    database_url: str
    jwt_secret: str = Field(min_length=32)
    frontend_url: str = "http://localhost:5173"
    jwt_expiry_days: int = Field(default=7, ge=1)
    allow_demo_seed: bool = False
    bootstrap_demo_catalog: bool = False

    @field_validator("database_url")
    @classmethod
    def require_postgresql(cls, value: str) -> str:
        url = make_url(value.replace("postgres://", "postgresql://", 1))
        if url.get_backend_name() != "postgresql":
            raise ValueError("DATABASE_URL must use PostgreSQL")
        url = url.set(drivername="postgresql+asyncpg")
        # Managed PostgreSQL providers commonly issue libpq-style URLs.
        query = dict(url.query)
        if "sslmode" in query:
            query["ssl"] = query.pop("sslmode")
        return url.set(query=query).render_as_string(hide_password=False)

    @field_validator("jwt_secret")
    @classmethod
    def require_nonblank_secret(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("JWT_SECRET must be set")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
