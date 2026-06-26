import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from features.auth.schemas import TokenResponse
from features.users.schemas import UserRead
from shared.enums.permissions import Permission


class TestAuthAPI:
    @pytest.mark.asyncio
    async def test_create_registration(self, client: AsyncClient):
        user_id = uuid.uuid4()
        mock_user_read = UserRead(
            id=user_id,
            name="Test Ivan",
            phone_number="79001234567",
            permissions=[Permission.ORDERS_CREATE],
        )

        with patch(
            "features.auth.service.register_user",
            new_callable=AsyncMock,
            return_value=mock_user_read,
        ) as mock_register:
            response = await client.post(
                "/api/v1/register",
                json={
                    "name": "Test Ivan",
                    "phone_number": "79001234567",
                    "password": "strongpassword123",
                },
            )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == str(user_id)
        assert data["name"] == "Test Ivan"
        mock_register.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_login(self, client: AsyncClient):
        mock_token_resp = TokenResponse(
            access_token="mock_access",
            refresh_token="mock_refresh",
            token_type="bearer",
        )

        with patch(
            "features.auth.service.login_user",
            new_callable=AsyncMock,
            return_value=mock_token_resp,
        ) as mock_login:
            response = await client.post(
                "/api/v1/login",
                json={"phone_number": "79001234567", "password": "strongpassword123"},
            )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["access_token"] == "mock_access"
        assert data["refresh_token"] == "mock_refresh"
        mock_login.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_refresh(self, client: AsyncClient):
        mock_token_resp = TokenResponse(
            access_token="new_access",
            refresh_token="new_refresh",
            token_type="bearer",
        )

        with patch(
            "features.auth.service.refresh_user_token",
            new_callable=AsyncMock,
            return_value=mock_token_resp,
        ) as mock_refresh:
            response = await client.post("/api/v1/refresh")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["access_token"] == "new_access"
        assert data["refresh_token"] == "new_refresh"
        mock_refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_logout(self, client: AsyncClient):
        with patch(
            "features.auth.service.logout_user",
            new_callable=AsyncMock,
        ) as mock_logout:
            response = await client.post("/api/v1/logout")

        assert response.status_code == 204
        assert response.content == b""
        mock_logout.assert_awaited_once()
