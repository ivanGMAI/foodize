from pydantic import Field

from settings.config.base import BaseConfig


class LogsConfig(BaseConfig):
    level: str = Field(default="INFO")
    sentry_dsn: str | None = Field(default=None)
    environment: str = Field(default="development")
