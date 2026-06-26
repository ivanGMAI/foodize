from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.auth.service import (
    OAuth2PasswordBearerWithCookie,
    get_current_user,
    logout_user,
)
from shared.exceptions.existence import AuthException


class TestOAuth2PasswordBearerWithCookie:
    @pytest.mark.asyncio
    async def test_returns_cookie_token(self):
        scheme = OAuth2PasswordBearerWithCookie(tokenUrl="/token", auto_error=False)
        request = MagicMock()
        request.cookies = {"access_token": "cookie_token"}

        result = await scheme(request)
        assert result == "cookie_token"

    @pytest.mark.asyncio
    async def test_returns_bearer_header_when_no_cookie(self):
        scheme = OAuth2PasswordBearerWithCookie(tokenUrl="/token", auto_error=False)
        request = MagicMock()
        request.cookies = {}
        request.headers = {"Authorization": "Bearer header_token"}

        with patch.object(
            OAuth2PasswordBearerWithCookie.__bases__[0],
            "__call__",
            new_callable=AsyncMock,
            return_value="header_token",
        ):
            result = await scheme(request)
            assert result == "header_token"

    @pytest.mark.asyncio
    async def test_returns_none_when_no_token(self):
        scheme = OAuth2PasswordBearerWithCookie(tokenUrl="/token", auto_error=False)
        request = MagicMock()
        request.cookies = {}
        request.headers = {}

        with patch.object(
            OAuth2PasswordBearerWithCookie.__bases__[0],
            "__call__",
            new_callable=AsyncMock,
            return_value=None,
        ):
            result = await scheme(request)
            assert result is None


class TestGetCurrentUserDeactivated:
    @pytest.mark.asyncio
    async def test_inactive_user_raises(self):
        user = MagicMock()
        user.is_active = False

        with (
            patch(
                "features.auth.service.decode_jwt",
                return_value={"sub": "00000000-0000-0000-0000-000000000001"},
            ),
            patch(
                "features.auth.service.get_user_by_id_or_404",
                new_callable=AsyncMock,
                return_value=user,
            ),
            patch(
                "features.auth.service.get_redis_cache",
                return_value=MagicMock(exists=AsyncMock(return_value=False)),
            ),
        ):
            with pytest.raises(AuthException):
                await get_current_user("some_token", AsyncMock())


class TestLogoutUser:
    @pytest.mark.asyncio
    async def test_deletes_both_cookies(self):
        request = MagicMock()
        request.cookies = {}
        request.headers = {}
        response = MagicMock()

        await logout_user(request, response)

        assert response.delete_cookie.call_count == 2
        calls = [call[0][0] for call in response.delete_cookie.call_args_list]
        assert "access_token" in calls
        assert "refresh_token" in calls
