from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException as StarletteHTTPException

from api import router as api_router
from api.exception_handlers import (
    app_exception_handler,
    http_exception_handler,
    integrity_error_handler,
    request_validation_error_handler,
    unhandled_exception_handler,
)
from database import db_helper
from features.notifications.broker import broker
from infra.cache.redis import close_redis_pool, get_redis_cache
from middlewares.cache import AutoCacheMiddleware
from middlewares.limiter import limiter
from middlewares.request_id import RequestIDMiddleware
from middlewares.security import SecurityHeadersMiddleware
from settings.config.app_config import settings
from shared.exceptions.base import AppException
from utils.logging_setup import configure_logging

configure_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await broker.connect()
    yield
    await broker.disconnect()
    await close_redis_pool()


app = FastAPI(lifespan=lifespan)
app.state.limiter = limiter

app.add_middleware(RequestIDMiddleware)
app.add_middleware(AutoCacheMiddleware, ttl=300)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]
app.add_exception_handler(RequestValidationError, request_validation_error_handler)  # type: ignore[arg-type]
app.add_exception_handler(AppException, app_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore[arg-type]
app.add_exception_handler(IntegrityError, integrity_error_handler)  # type: ignore[arg-type]
app.add_exception_handler(Exception, unhandled_exception_handler)
app.include_router(api_router)

Instrumentator().instrument(app).expose(app, include_in_schema=False, should_gzip=True)


@app.get("/api/ping")
async def ping():
    return {"status": "pong"}


@app.get("/api/health")
async def health():
    checks: dict[str, str] = {}

    try:
        async with db_helper.session_factory() as session:
            await session.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception:
        checks["db"] = "error"

    try:
        cache = get_redis_cache()
        await cache.exists("health")
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "error"

    try:
        if broker._connection and not broker._connection.is_closed:
            checks["rabbitmq"] = "ok"
        else:
            checks["rabbitmq"] = "error"
    except Exception:
        checks["rabbitmq"] = "error"

    overall = "ok" if all(v == "ok" for v in checks.values()) else "degraded"
    return {"status": overall, "checks": checks}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.run.host,
        port=settings.run.port,
    )
