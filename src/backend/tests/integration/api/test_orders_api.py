import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from features.orders.dependencies import (
    get_order_for_staff_or_vendor,
    get_restaurant_staff_or_vendor,
)
from features.orders.exceptions import (
    OrderNotCancellableException,
    OrderNotFoundException,
)
from features.orders.models import Order
from features.restaurants.models import Restaurant
from main import app
from shared.enums.order_status import OrderStatus

MOCK_CREATED_AT = "2026-01-01T00:00:00"


def _make_mock_order_dict(order_id, user_id, restaurant_id, status=OrderStatus.PENDING, items=None):
    return {
        "id": str(order_id),
        "display_id": 1001,
        "user_id": str(user_id),
        "restaurant_id": str(restaurant_id),
        "status": status.value,
        "total_price": 500,
        "created_at": MOCK_CREATED_AT,
        "items": items or [],
    }


class TestOrdersAPI:
    @pytest.mark.asyncio
    async def test_create_order(self, client: AsyncClient, as_user):
        order_id = uuid.uuid4()
        restaurant_id = uuid.uuid4()
        menu_item_id = uuid.uuid4()

        mock_order = _make_mock_order_dict(
            order_id,
            as_user.id,
            restaurant_id,
            items=[
                {
                    "id": str(uuid.uuid4()),
                    "menu_item_id": str(menu_item_id),
                    "menu_item_name": "Pizza",
                    "menu_item_category": "PIZZA",
                    "menu_item_prep_time": 10,
                    "quantity": 2,
                    "price_at_purchase": 250,
                    "selected_options": [],
                }
            ],
        )

        with patch(
            "features.orders.api.order.service.place_order",
            new_callable=AsyncMock,
            return_value=mock_order,
        ) as mock_place:
            response = await client.post(
                "/api/v1/orders/",
                json={
                    "restaurant_id": str(restaurant_id),
                    "items": [{"menu_item_id": str(menu_item_id), "quantity": 2}],
                },
            )

        assert response.status_code == 201
        data = response.json()["data"]
        assert data["id"] == str(order_id)
        mock_place.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_read_my_orders(self, client: AsyncClient, as_user):
        with patch(
            "features.orders.api.order.service.get_user_orders",
            new_callable=AsyncMock,
            return_value=([], 0),
        ) as mock_get_all:
            response = await client.get("/api/v1/orders/me")

        assert response.status_code == 200
        body = response.json()
        assert body["data"] == []
        assert body["pagination"]["total"] == 0
        mock_get_all.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_read_order_by_id(self, client: AsyncClient, as_user):
        order_id = uuid.uuid4()
        mock_order = _make_mock_order_dict(order_id, as_user.id, uuid.uuid4())

        with (
            patch(
                "features.orders.api.order.service.order_crud.get_order_by_identifier",
                new_callable=AsyncMock,
                return_value=mock_order,
            ) as mock_get,
            patch(
                "features.orders.api.order.verify_order_read_access",
                new_callable=AsyncMock,
            ),
        ):
            response = await client.get(f"/api/v1/orders/{order_id}")

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == str(order_id)
        mock_get.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_order_requires_auth(self, client: AsyncClient):
        response = await client.post(
            "/api/v1/orders/",
            json={
                "restaurant_id": str(uuid.uuid4()),
                "items": [{"menu_item_id": str(uuid.uuid4()), "quantity": 1}],
            },
        )
        assert response.status_code == 401


class TestRestaurantOrdersAPI:
    def _make_mock_restaurant(self, restaurant_id: uuid.UUID) -> Restaurant:
        r = Restaurant()
        r.id = restaurant_id
        r.name = "Test"
        r.address = "Test addr"
        r.vendor_id = uuid.uuid4()
        r.is_hiring = True
        return r

    @pytest.mark.asyncio
    async def test_read_restaurant_orders(self, client: AsyncClient, as_vendor):
        restaurant_id = uuid.uuid4()
        mock_restaurant = self._make_mock_restaurant(restaurant_id)

        mock_orders = [_make_mock_order_dict(uuid.uuid4(), uuid.uuid4(), restaurant_id)]

        app.dependency_overrides[get_restaurant_staff_or_vendor] = lambda: mock_restaurant

        with patch(
            "features.orders.api.order.service.get_restaurant_orders",
            new_callable=AsyncMock,
            return_value=(mock_orders, 1),
        ) as mock_get:
            response = await client.get(f"/api/v1/orders/restaurant/{restaurant_id}")

        app.dependency_overrides.pop(get_restaurant_staff_or_vendor, None)

        assert response.status_code == 200
        body = response.json()
        assert len(body["data"]) == 1
        assert body["data"][0]["restaurant_id"] == str(restaurant_id)
        assert body["pagination"]["total"] == 1
        mock_get.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_order_status(self, client: AsyncClient, as_vendor):
        order_id = uuid.uuid4()
        restaurant_id = uuid.uuid4()
        mock_order_response = _make_mock_order_dict(
            order_id, uuid.uuid4(), restaurant_id, OrderStatus.ACCEPTED
        )

        mock_order_obj = Order()
        mock_order_obj.id = order_id

        app.dependency_overrides[get_order_for_staff_or_vendor] = lambda: mock_order_obj
        try:
            with patch(
                "features.orders.api.order.service.change_order_status",
                new_callable=AsyncMock,
                return_value=mock_order_response,
            ) as mock_change:
                response = await client.patch(
                    f"/api/v1/orders/{order_id}/status",
                    json={"status": OrderStatus.ACCEPTED.value},
                )
        finally:
            app.dependency_overrides.pop(get_order_for_staff_or_vendor, None)

        assert response.status_code == 200
        data = response.json()["data"]
        assert data["status"] == OrderStatus.ACCEPTED.value
        mock_change.assert_awaited_once()


class TestCancelOrderAPI:
    @pytest.mark.asyncio
    async def test_update_order_cancel_success(self, client: AsyncClient, as_user):
        order_id = uuid.uuid4()
        mock_order = _make_mock_order_dict(
            order_id, as_user.id, uuid.uuid4(), OrderStatus.CANCELLED
        )

        with patch(
            "features.orders.api.order.service.cancel_order",
            new_callable=AsyncMock,
            return_value=mock_order,
        ) as mock_cancel:
            response = await client.post(f"/api/v1/orders/{order_id}/cancel", json={})

        assert response.status_code == 200
        assert response.json()["data"]["status"] == OrderStatus.CANCELLED.value
        mock_cancel.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_order_cancel_not_found(self, client: AsyncClient, as_user):
        order_id = uuid.uuid4()

        with patch(
            "features.orders.api.order.service.cancel_order",
            new_callable=AsyncMock,
            side_effect=OrderNotFoundException(),
        ):
            response = await client.post(f"/api/v1/orders/{order_id}/cancel", json={})

        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_order_cancel_non_pending(self, client: AsyncClient, as_user):
        order_id = uuid.uuid4()

        with patch(
            "features.orders.api.order.service.cancel_order",
            new_callable=AsyncMock,
            side_effect=OrderNotCancellableException(),
        ):
            response = await client.post(f"/api/v1/orders/{order_id}/cancel", json={})

        assert response.status_code == 409
