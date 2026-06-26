import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import Response

from features.telegram.service import (
    request_site_login_code,
    set_site_password,
    verify_site_login_code,
)
from features.users.models import User
from shared.exceptions.existence import AuthException, NotFoundException


def _user(*, telegram_id: int | None = 123456, hashed_password: str | None = None) -> User:
    user = User()
    user.id = uuid.uuid4()
    user.name = "Telegram User"
    user.phone_number = "79001234567"
    user.telegram_id = telegram_id
    user.hashed_password = hashed_password
    return user


class _HttpResponse:
    def raise_for_status(self):
        return None


class _HttpClient:
    post = AsyncMock(return_value=_HttpResponse())

    def __init__(self, *args, **kwargs):
        pass

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None


@pytest.mark.asyncio
async def test_request_site_login_code_saves_code_and_sends_telegram_message():
    cache = MagicMock()
    cache.set = AsyncMock()
    raw_client = MagicMock()
    raw_client.incr = AsyncMock(return_value=1)
    raw_client.expire = AsyncMock()
    cache.get_raw_client.return_value = raw_client
    _HttpClient.post.reset_mock()

    with (
        patch(
            "features.telegram.service.get_user_by_phone",
            new_callable=AsyncMock,
            return_value=_user(),
        ),
        patch("features.telegram.service.get_redis_cache", return_value=cache),
        patch("features.telegram.service.secrets.randbelow", return_value=42),
        patch("features.telegram.service.httpx.AsyncClient", _HttpClient),
    ):
        await request_site_login_code(AsyncMock(), "79001234567")

    cache.set.assert_awaited_once_with(
        "telegram_site_login:79001234567",
        "000042",
        ttl=300,
    )
    _HttpClient.post.assert_awaited_once()
    assert _HttpClient.post.call_args.kwargs["json"]["chat_id"] == 123456
    assert "000042" in _HttpClient.post.call_args.kwargs["json"]["text"]


@pytest.mark.asyncio
async def test_request_site_login_code_rejects_unknown_phone():
    with patch(
        "features.telegram.service.get_user_by_phone",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(NotFoundException):
            await request_site_login_code(AsyncMock(), "79001234567")


@pytest.mark.asyncio
async def test_verify_site_login_code_deletes_code_and_issues_tokens():
    user = _user()
    cache = MagicMock()
    cache.get = AsyncMock(return_value="123456")
    cache.delete = AsyncMock()

    with (
        patch("features.telegram.service.get_redis_cache", return_value=cache),
        patch(
            "features.telegram.service.get_user_by_phone",
            new_callable=AsyncMock,
            return_value=user,
        ),
        patch("features.telegram.service.issue_user_tokens") as issue_tokens,
    ):
        issue_tokens.return_value.access_token = "access"
        issue_tokens.return_value.refresh_token = "refresh"
        issue_tokens.return_value.token_type = "Bearer"
        result = await verify_site_login_code(AsyncMock(), "79001234567", "123456", Response())

    assert result.access_token == "access"
    assert result.refresh_token == "refresh"
    assert result.requires_password is True
    cache.delete.assert_awaited_once_with("telegram_site_login:79001234567")


@pytest.mark.asyncio
async def test_verify_site_login_code_rejects_wrong_code():
    cache = MagicMock()
    cache.get = AsyncMock(return_value="123456")

    with patch("features.telegram.service.get_redis_cache", return_value=cache):
        with pytest.raises(AuthException, match="Invalid Telegram code"):
            await verify_site_login_code(AsyncMock(), "79001234567", "000000", Response())


@pytest.mark.asyncio
async def test_set_site_password_hashes_only_empty_password():
    user = _user(hashed_password=None)
    session = AsyncMock()

    with patch("features.telegram.service.hash_password", return_value="hashed"):
        result = await set_site_password(session, user, "strongpassword")

    assert result.hashed_password == "hashed"
    session.commit.assert_awaited_once()
    session.refresh.assert_awaited_once_with(user)


@pytest.mark.asyncio
async def test_set_site_password_rejects_existing_password():
    with pytest.raises(AuthException, match="Password is already set"):
        await set_site_password(AsyncMock(), _user(hashed_password="hashed"), "newpass")
