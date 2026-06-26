import logging
import sys

import sentry_sdk
import structlog
from sentry_sdk.integrations import Integration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from settings.config.app_config import settings

_fastapi_integration: type[Integration] | None
try:
    from sentry_sdk.integrations.fastapi import FastApiIntegration

    _fastapi_integration = FastApiIntegration
except ImportError:
    try:
        from sentry_sdk.integrations.starlette import StarletteIntegration

        _fastapi_integration = StarletteIntegration
    except ImportError:
        _fastapi_integration = None

LOGGER_NAME = "foodize"


def configure_logging() -> None:
    level = settings.logs.level.upper()
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=level,
    )

    if settings.logs.sentry_dsn:
        integrations: list[Integration] = [SqlalchemyIntegration()]
        if _fastapi_integration is not None:
            integrations.insert(0, _fastapi_integration())

        sentry_sdk.init(
            dsn=settings.logs.sentry_dsn,
            environment=settings.logs.environment,
            integrations=integrations,
            traces_sample_rate=1.0,
        )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso", key="timestamp"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str = LOGGER_NAME) -> structlog.BoundLogger:
    return structlog.get_logger(name).bind(service="foodize")
