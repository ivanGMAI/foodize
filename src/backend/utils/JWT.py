import uuid
from datetime import datetime, timedelta

import bcrypt
import jwt
from pytz import utc  # type: ignore[import-untyped]

from settings.config.app_config import settings

_private_key: str = settings.auth.private_key_path.read_text()
_public_key: str = settings.auth.public_key_path.read_text()


def encode_jwt(
    payload: dict,
    private_key: str = _private_key,
    algorithm: str = settings.auth.algorithm,
):
    return jwt.encode(payload, private_key, algorithm=algorithm)


def decode_jwt(
    token: str,
    public_key: str = _public_key,
    algorithm: str = settings.auth.algorithm,
) -> dict:
    return jwt.decode(token, public_key, algorithms=[algorithm])


def create_jwt_token(
    user_id: uuid.UUID,
    phone_number: str,
    lifetime_seconds: int,
) -> str:
    current_time_utc = datetime.now(utc)
    expire = current_time_utc + timedelta(seconds=lifetime_seconds)
    payload = {
        "sub": str(user_id),
        "phone": phone_number,
        "exp": expire,
        "iat": current_time_utc,
    }
    return encode_jwt(payload=payload)


def create_access_token(user_id: uuid.UUID, phone_number: str) -> str:
    return create_jwt_token(
        user_id=user_id,
        phone_number=phone_number,
        lifetime_seconds=settings.auth.access_token_lifetime_seconds,
    )


def create_refresh_token(user_id: uuid.UUID, phone_number: str) -> str:
    return create_jwt_token(
        user_id=user_id,
        phone_number=phone_number,
        lifetime_seconds=settings.auth.refresh_token_lifetime_seconds,
    )


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode("utf-8")


def validate_password(password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        password=password.encode("utf-8"),
        hashed_password=hashed_password.encode("utf-8"),
    )
