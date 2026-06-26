from settings.config.base import BaseConfig
from settings.config.infra import DbConfig, RabbitMQConfig
from settings.config.infra.redis import RedisConfig
from settings.config.runtime import (
    ApiPrefix,
    AuthConfig,
    CorsConfig,
    LLMConfig,
    LogsConfig,
    RunConfig,
    TelegramConfig,
)


class AppConfig(BaseConfig):
    run: RunConfig = RunConfig()
    db: DbConfig
    api: ApiPrefix = ApiPrefix()
    auth: AuthConfig = AuthConfig()
    redis: RedisConfig = RedisConfig()
    rabbitmq: RabbitMQConfig = RabbitMQConfig()
    cors: CorsConfig = CorsConfig()
    logs: LogsConfig = LogsConfig()
    telegram: TelegramConfig = TelegramConfig()
    llm: LLMConfig = LLMConfig()


settings = AppConfig()  # type: ignore[call-arg]
