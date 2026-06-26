import uuid
from unittest.mock import AsyncMock, patch

import pytest
from factories import make_user
from httpx import AsyncClient


class TestUsersAPI:
    @pytest.mark.asyncio
    async def test_read_user_by_id(self, client: AsyncClient, as_user):
        user_id = as_user.id
        mock_user = make_user(user_id=user_id, name="Target User")

        with patch(
            "features.users.api.get_user_by_id_or_404",
            new_callable=AsyncMock,
            return_value=mock_user,
        ) as mock_get:
            response = await client.get(f"/api/v1/users/{user_id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == str(user_id)
        assert data["name"] == "Target User"
        mock_get.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_read_my_profile(self, client: AsyncClient, as_user):
        response = await client.get("/api/v1/users/me")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == str(as_user.id)
        assert data["name"] == as_user.name

    @pytest.mark.asyncio
    async def test_update_my_profile(self, client: AsyncClient, as_user):
        updated_user = make_user(user_id=as_user.id, name="Updated Name")

        with patch(
            "features.users.crud.update_user",
            new_callable=AsyncMock,
            return_value=updated_user,
        ) as mock_update:
            response = await client.patch(
                "/api/v1/users/me",
                json={"name": "Updated Name"},
            )

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["name"] == "Updated Name"
        mock_update.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_read_user_requires_auth(self, client: AsyncClient):
        response = await client.get(f"/api/v1/users/{uuid.uuid4()}")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_change_password_no_content(self, client: AsyncClient, as_user):
        with (
            patch(
                "features.users.api.validate_password",
                return_value=True,
            ),
            patch(
                "features.users.crud.update_user_password",
                new_callable=AsyncMock,
            ),
        ):
            response = await client.post(
                "/api/v1/users/me/change-password",
                json={"old_password": "oldpass123", "new_password": "newpass123"},
            )
        assert response.status_code == 204

    @pytest.mark.asyncio
    async def test_change_password_wrong_old(self, client: AsyncClient, as_user):
        with patch(
            "features.users.api.validate_password",
            return_value=False,
        ):
            response = await client.post(
                "/api/v1/users/me/change-password",
                json={"old_password": "wrong", "new_password": "newpass123"},
            )
        assert response.status_code == 401
