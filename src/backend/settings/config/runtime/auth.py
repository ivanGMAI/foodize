from pathlib import Path

from settings.config.base import BASE_DIRECTORY, BaseConfig

_JWT_DIR = BASE_DIRECTORY / "certs"


class AuthConfig(BaseConfig):
    private_key_path: Path = _JWT_DIR / "jwt-private.pem"
    public_key_path: Path = _JWT_DIR / "jwt-public.pem"
    algorithm: str = "RS256"
    access_token_lifetime_seconds: int = 1800
    refresh_token_lifetime_seconds: int = 2_592_000
    email_token_lifetime_seconds: int = 7200
    password_token_lifetime_seconds: int = 600
    rate_limit_login: str = "10/minute"
    rate_limit_register: str = "10/minute"
