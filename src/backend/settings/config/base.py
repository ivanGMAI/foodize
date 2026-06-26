from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIRECTORY = Path(__file__).resolve().parent.parent.parent


class BaseConfig(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BASE_DIRECTORY.parent.parent / ".env",
        env_nested_delimiter="__",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )
