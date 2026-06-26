from settings.config.base import BaseConfig


class RunConfig(BaseConfig):
    host: str = "0.0.0.0"
    port: int = 8000


class ApiV1Prefix(BaseConfig):
    prefix: str = "/v1"


class ApiPrefix(BaseConfig):
    prefix: str = "/api"
    v1: ApiV1Prefix = ApiV1Prefix()
