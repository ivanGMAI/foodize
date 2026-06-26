import hashlib
import hmac
import json
import secrets
import time
from urllib.parse import parse_qsl

import httpx
from fastapi import Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from features.auth.schemas import TokenResponse
from features.auth.service import issue_user_tokens
from features.orders.models import Order
from features.telegram.crud import get_user_by_phone, get_user_by_telegram_id
from features.telegram.exceptions import (
    InvalidTelegramInitDataException,
    MalformedTelegramInitDataException,
)
from features.telegram.schemas import TelegramCheckResponse, TelegramSiteLoginResponse
from features.users.models import User
from features.vendors.models import VendorProfile
from infra.cache.redis import get_redis_cache
from settings.config.app_config import settings
from shared.enums.order_status import OrderStatus
from shared.exceptions.existence import AuthException, NotFoundException
from shared.permissions import CUSTOMER_PERMISSIONS, serialize_permissions
from utils.JWT import create_access_token, create_refresh_token, hash_password

_INIT_DATA_MAX_AGE = 86400
_SITE_LOGIN_CODE_TTL = 300
_SITE_LOGIN_CODE_PREFIX = "telegram_site_login:"
_SITE_LOGIN_RATE_PREFIX = "telegram_site_login_rate:"


def _validate_init_data(init_data: str) -> dict:
    try:
        parsed = dict(parse_qsl(init_data, strict_parsing=True))
    except Exception:
        raise MalformedTelegramInitDataException()

    received_hash = parsed.pop("hash", None)
    if not received_hash:
        raise MalformedTelegramInitDataException(detail="Missing hash")

    auth_date_raw = parsed.get("auth_date")
    if not auth_date_raw:
        raise MalformedTelegramInitDataException(detail="Missing auth_date")

    try:
        auth_date = int(auth_date_raw)
    except (ValueError, TypeError):
        raise MalformedTelegramInitDataException(detail="Invalid auth_date")

    if time.time() - auth_date > _INIT_DATA_MAX_AGE:
        raise InvalidTelegramInitDataException(detail="initData expired")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed.items()))

    secret_key = hmac.new(
        b"WebAppData",
        settings.telegram.bot_token.encode(),
        hashlib.sha256,
    ).digest()
    expected_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(expected_hash, received_hash):
        raise InvalidTelegramInitDataException()

    return parsed


def _extract_tg_user(parsed: dict) -> dict:
    raw = parsed.get("user", "{}")
    try:
        data = json.loads(raw)
        if "id" not in data:
            raise MalformedTelegramInitDataException(detail="Missing user id")
        return data
    except (json.JSONDecodeError, TypeError):
        raise MalformedTelegramInitDataException(detail="Invalid user payload")


async def _cache_telegram_id(user_id: str, telegram_id: int) -> None:
    cache = get_redis_cache()
    await cache.set(f"user_tg:{user_id}", str(telegram_id), ttl=86400 * 30)


async def _delete_cached_telegram_id(user_id: str) -> None:
    cache = get_redis_cache()
    await cache.delete(f"user_tg:{user_id}")


def _make_tokens(user: User) -> TokenResponse:
    access_token = create_access_token(user.id, str(user.phone_number))
    refresh_token = create_refresh_token(user.id, str(user.phone_number))
    return TokenResponse(
        access_token=access_token, refresh_token=refresh_token, token_type="Bearer"
    )


async def telegram_check(session: AsyncSession, init_data: str) -> TelegramCheckResponse:
    parsed = _validate_init_data(init_data)
    tg_user = _extract_tg_user(parsed)
    telegram_id = int(tg_user["id"])

    existing = await get_user_by_telegram_id(session, telegram_id)
    if existing:
        return TelegramCheckResponse(status="registered")

    phone = tg_user.get("phone_number")
    return TelegramCheckResponse(status="new_user", phone_number=phone)


async def get_vendor_status_for_telegram_id(
    session: AsyncSession, telegram_id: int
) -> VendorProfile | None:
    user = await get_user_by_telegram_id(session, telegram_id)
    if not user:
        return None

    result = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user.id))
    return result.scalar_one_or_none()


async def get_active_orders_for_telegram_id(
    session: AsyncSession, telegram_id: int, limit: int = 3
) -> list[Order]:
    user = await get_user_by_telegram_id(session, telegram_id)
    if not user:
        return []

    active_statuses = [
        OrderStatus.PENDING.value,
        OrderStatus.ACCEPTED.value,
        OrderStatus.READY.value,
    ]
    result = await session.execute(
        select(Order)
        .where(Order.user_id == user.id)
        .where(Order.status.in_(active_statuses))
        .options(selectinload(Order.restaurant))
        .order_by(Order.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def telegram_register(
    session: AsyncSession,
    init_data: str,
    phone_number: str,
    name: str,
) -> TokenResponse:
    parsed = _validate_init_data(init_data)
    tg_user = _extract_tg_user(parsed)
    telegram_id = int(tg_user["id"])
    telegram_username = tg_user.get("username")

    existing_by_tg = await get_user_by_telegram_id(session, telegram_id)
    if existing_by_tg:
        await _cache_telegram_id(str(existing_by_tg.id), telegram_id)
        return _make_tokens(existing_by_tg)

    existing_by_phone = await get_user_by_phone(session, phone_number)
    if existing_by_phone:
        existing_by_phone.telegram_id = telegram_id
        existing_by_phone.telegram_username = telegram_username
        await session.commit()
        await _cache_telegram_id(str(existing_by_phone.id), telegram_id)
        return _make_tokens(existing_by_phone)

    new_user = User(
        name=name,
        phone_number=phone_number,
        hashed_password=None,
        telegram_id=telegram_id,
        telegram_username=telegram_username,
        permissions=serialize_permissions(CUSTOMER_PERMISSIONS),
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    await _cache_telegram_id(str(new_user.id), telegram_id)
    return _make_tokens(new_user)


async def link_phone_from_bot(
    session: AsyncSession,
    telegram_id: int,
    telegram_username: str | None,
    phone_number: str,
    name: str,
) -> User:
    existing_by_tg = await get_user_by_telegram_id(session, telegram_id)
    if existing_by_tg:
        await _cache_telegram_id(str(existing_by_tg.id), telegram_id)
        return existing_by_tg

    existing_by_phone = await get_user_by_phone(session, phone_number)
    if existing_by_phone:
        existing_by_phone.telegram_id = telegram_id
        existing_by_phone.telegram_username = telegram_username
        await session.commit()
        await session.refresh(existing_by_phone)
        await _cache_telegram_id(str(existing_by_phone.id), telegram_id)
        return existing_by_phone

    new_user = User(
        name=name,
        phone_number=phone_number,
        hashed_password=None,
        telegram_id=telegram_id,
        telegram_username=telegram_username,
        permissions=serialize_permissions(CUSTOMER_PERMISSIONS),
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)
    await _cache_telegram_id(str(new_user.id), telegram_id)
    return new_user


async def unlink_telegram_for_user(session: AsyncSession, user: User) -> User:
    user.telegram_id = None
    user.telegram_username = None
    await session.commit()
    await session.refresh(user)
    await _delete_cached_telegram_id(str(user.id))
    return user


async def telegram_auth_existing(session: AsyncSession, init_data: str) -> TokenResponse:
    parsed = _validate_init_data(init_data)
    tg_user = _extract_tg_user(parsed)
    telegram_id = int(tg_user["id"])

    user = await get_user_by_telegram_id(session, telegram_id)
    if not user:
        raise InvalidTelegramInitDataException(detail="User not found")

    await _cache_telegram_id(str(user.id), telegram_id)
    return _make_tokens(user)


async def request_site_login_code(session: AsyncSession, phone_number: str) -> None:
    user = await get_user_by_phone(session, phone_number)
    if not user:
        raise NotFoundException(detail="User with this phone was not found")
    if not user.telegram_id:
        raise AuthException(detail="Telegram is not linked to this account")
    if not settings.telegram.bot_token:
        raise AuthException(detail="Telegram bot is not configured")

    cache = get_redis_cache()
    rate_key = f"{_SITE_LOGIN_RATE_PREFIX}{phone_number}"
    raw_client = cache.get_raw_client()
    requests_count = await raw_client.incr(rate_key)
    if requests_count == 1:
        await raw_client.expire(rate_key, 300)
    if requests_count > 5:
        raise AuthException(detail="Too many code requests")

    code = f"{secrets.randbelow(1_000_000):06d}"
    await cache.set(f"{_SITE_LOGIN_CODE_PREFIX}{phone_number}", code, ttl=_SITE_LOGIN_CODE_TTL)

    message = (
        f"Код входа на сайт Foodize: {code}\n\n"
        "Если это были не вы, просто проигнорируйте сообщение."
    )

    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(
            f"https://api.telegram.org/bot{settings.telegram.bot_token}/sendMessage",
            json={
                "chat_id": user.telegram_id,
                "text": message,
            },
        )
        response.raise_for_status()


async def verify_site_login_code(
    session: AsyncSession,
    phone_number: str,
    code: str,
    response: Response,
) -> TelegramSiteLoginResponse:
    cache = get_redis_cache()
    key = f"{_SITE_LOGIN_CODE_PREFIX}{phone_number}"
    stored_code = await cache.get(key)
    if not stored_code or not secrets.compare_digest(stored_code, code):
        raise AuthException(detail="Invalid Telegram code")

    user = await get_user_by_phone(session, phone_number)
    if not user or not user.telegram_id:
        raise AuthException(detail="Telegram is not linked to this account")

    await cache.delete(key)
    tokens = issue_user_tokens(user=user, response=response)
    return TelegramSiteLoginResponse(
        access_token=tokens.access_token,
        refresh_token=tokens.refresh_token,
        token_type=tokens.token_type,
        requires_password=not bool(user.hashed_password),
    )


async def set_site_password(session: AsyncSession, user: User, password: str) -> User:
    if user.hashed_password:
        raise AuthException(detail="Password is already set")

    user.hashed_password = hash_password(password)
    await session.commit()
    await session.refresh(user)
    return user
