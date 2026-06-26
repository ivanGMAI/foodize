import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from shared.enums.order_status import OrderStatus
from shared.enums.permissions import Permission

MOCK_CREATED_AT = "2026-01-01T00:00:00"


def _make_admin_user_dict(user_id: uuid.UUID | None = None) -> dict:
    return {
        "id": str(user_id or uuid.uuid4()),
        "name": "Admin",
        "phone_number": "79000000000",
        "permissions": [Permission.ORDERS_CREATE.value],
        "is_active": True,
        "created_at": "2026-01-01T00:00:00",
    }


def _make_admin_order_dict() -> dict:
    return {
        "id": str(uuid.uuid4()),
        "display_id": 1001,
        "user_id": str(uuid.uuid4()),
        "restaurant_id": str(uuid.uuid4()),
        "status": OrderStatus.PENDING.value,
        "total_price": 500,
        "created_at": MOCK_CREATED_AT,
        "items": [],
    }


class TestAdminAccess:
    @pytest.mark.asyncio
    async def test_requires_auth(self, client: AsyncClient):
        response = await client.get("/api/v1/admin/users")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_requires_admin_role(self, client: AsyncClient, as_user):
        response = await client.get("/api/v1/admin/users")
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_vendor_denied(self, client: AsyncClient, as_vendor):
        response = await client.get("/api/v1/admin/users")
        assert response.status_code == 403


class TestAdminUsers:
    @pytest.mark.asyncio
    async def test_read_users(self, client: AsyncClient, as_admin):
        mock_users = [_make_admin_user_dict() for _ in range(3)]

        with (
            patch(
                "features.admin.crud.get_all_users",
                new_callable=AsyncMock,
                return_value=mock_users,
            ),
            patch(
                "features.admin.crud.count_all_users",
                new_callable=AsyncMock,
                return_value=3,
            ),
        ):
            response = await client.get("/api/v1/admin/users")

        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 3
        assert body["pagination"]["total"] == 3

    @pytest.mark.asyncio
    async def test_read_users_filter_by_role(self, client: AsyncClient, as_admin):
        with (
            patch(
                "features.admin.crud.get_all_users",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "features.admin.crud.count_all_users",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            response = await client.get("/api/v1/admin/users?role=VENDOR")

        assert response.status_code == 200
        assert response.json()["pagination"]["total"] == 0

    @pytest.mark.asyncio
    async def test_read_user_by_id(self, client: AsyncClient, as_admin):
        user_id = uuid.uuid4()
        mock_user = _make_admin_user_dict(user_id)

        with patch(
            "features.admin.crud.get_user_by_id",
            new_callable=AsyncMock,
            return_value=mock_user,
        ):
            response = await client.get(f"/api/v1/admin/users/{user_id}")

        assert response.status_code == 200
        assert response.json()["data"]["id"] == str(user_id)

    @pytest.mark.asyncio
    async def test_read_user_not_found(self, client: AsyncClient, as_admin):
        with patch(
            "features.admin.crud.get_user_by_id",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = await client.get(f"/api/v1/admin/users/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_user(self, client: AsyncClient, as_admin):
        user_id = uuid.uuid4()
        mock_user = _make_admin_user_dict(user_id)
        deactivated = {**mock_user, "is_active": False}

        with (
            patch(
                "features.admin.crud.get_user_by_id",
                new_callable=AsyncMock,
                return_value=mock_user,
            ),
            patch(
                "features.admin.crud.deactivate_user",
                new_callable=AsyncMock,
                return_value=deactivated,
            ),
        ):
            response = await client.delete(f"/api/v1/admin/users/{user_id}")

        assert response.status_code == 200
        assert response.json()["data"]["is_active"] is False

    @pytest.mark.asyncio
    async def test_delete_user_not_found(self, client: AsyncClient, as_admin):
        with patch(
            "features.admin.crud.get_user_by_id",
            new_callable=AsyncMock,
            return_value=None,
        ):
            response = await client.delete(f"/api/v1/admin/users/{uuid.uuid4()}")

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_activate_user(self, client: AsyncClient, as_admin):
        user_id = uuid.uuid4()
        mock_user = _make_admin_user_dict(user_id)
        activated = {**mock_user, "is_active": True}

        with (
            patch(
                "features.admin.crud.get_user_by_id",
                new_callable=AsyncMock,
                return_value=mock_user,
            ),
            patch(
                "features.admin.crud.activate_user",
                new_callable=AsyncMock,
                return_value=activated,
            ),
        ):
            response = await client.post(f"/api/v1/admin/users/{user_id}/activate")

        assert response.status_code == 200
        assert response.json()["data"]["is_active"] is True

    @pytest.mark.asyncio
    async def test_grant_admin_permissions(self, client: AsyncClient, as_admin):
        user_id = uuid.uuid4()
        mock_user = _make_admin_user_dict(user_id)
        promoted = {**mock_user, "permissions": [Permission.ADMIN_ACCESS.value]}

        with patch(
            "features.admin.service.set_user_permissions",
            new_callable=AsyncMock,
            return_value=promoted,
        ):
            response = await client.post(f"/api/v1/admin/users/{user_id}/grant-admin")

        assert response.status_code == 200
        assert response.json()["data"]["permissions"] == [Permission.ADMIN_ACCESS.value]


class TestAdminOrders:
    @pytest.mark.asyncio
    async def test_read_orders(self, client: AsyncClient, as_admin):
        mock_orders = [_make_admin_order_dict()]

        with (
            patch(
                "features.admin.crud.get_all_orders",
                new_callable=AsyncMock,
                return_value=mock_orders,
            ),
            patch(
                "features.admin.crud.count_all_orders",
                new_callable=AsyncMock,
                return_value=1,
            ),
        ):
            response = await client.get("/api/v1/admin/orders")

        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 1
        assert body["pagination"]["total"] == 1

    @pytest.mark.asyncio
    async def test_read_orders_with_filters(self, client: AsyncClient, as_admin):
        with (
            patch(
                "features.admin.crud.get_all_orders",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "features.admin.crud.count_all_orders",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            response = await client.get("/api/v1/admin/orders?status=PENDING")

        assert response.status_code == 200
        assert response.json()["pagination"]["total"] == 0


class TestAdminStats:
    @pytest.mark.asyncio
    async def test_read_stats(self, client: AsyncClient, as_admin):
        mock_stats = {
            "users_by_permission": {Permission.ORDERS_CREATE.value: 10},
            "users_by_role": {"CUSTOMER": 10, "VENDOR": 3, "ADMIN": 1},
            "total_users": 14,
            "orders_by_status": {"PENDING": 5, "COMPLETED": 20},
            "total_restaurants": 4,
            "total_vendors": 3,
            "growth": {
                "users": [{"date": "2026-01-01", "count": 2}],
                "restaurants": [{"date": "2026-01-01", "count": 1}],
                "orders": [{"date": "2026-01-01", "count": 5}],
                "vendors": [{"date": "2026-01-01", "count": 1}],
            },
        }

        with patch(
            "features.admin.crud.get_platform_stats",
            new_callable=AsyncMock,
            return_value=mock_stats,
        ):
            response = await client.get("/api/v1/admin/stats")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["total_restaurants"] == 4
        assert data["total_vendors"] == 3
        assert data["users_by_role"]["CUSTOMER"] == 10
        assert data["orders_by_status"]["COMPLETED"] == 20
