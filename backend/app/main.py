import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import get_settings
from app.db.session import get_engine, get_session_factory
from app.routers.auth import router as auth_router
from app.routers.colleges import router as colleges_router
from app.routers.workspace import router as workspace_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    get_settings()  # Fail startup if required configuration is missing.
    yield
    await get_engine().dispose()
    get_session_factory.cache_clear()
    get_engine.cache_clear()


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="College Finder API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(colleges_router, prefix="/api")
    app.include_router(auth_router, prefix="/api")
    app.include_router(workspace_router, prefix="/api")

    @app.get("/api/health", tags=["Health"])
    async def health():
        return {"status": "ok"}

    @app.get("/api/health/ready", tags=["Health"])
    async def readiness():
        try:
            async with get_engine().connect() as connection:
                await connection.execute(text("SELECT 1"))
        except (SQLAlchemyError, OSError):
            return JSONResponse(status_code=503, content={"detail": "Database unavailable"})
        return {"status": "ok", "database": "ok"}

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request: Request, exc: SQLAlchemyError):
        logger.error("Database request failed at %s: %s", request.url.path, type(exc).__name__)
        return JSONResponse(status_code=500, content={"detail": "Database request failed"})

    return app


app = create_app()
