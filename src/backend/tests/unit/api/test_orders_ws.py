import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from factories import make_user

from features.orders.api.ws import _build_display_board, _can_read_order
from shared.enums.order_status import OrderStatus
from shared.enums.permissions import Permission
from shared.enums.roles import UserRole


def _order(user_id: uuid.UUID | None = None, restaurant_id: uuid.UUID | None = None):
    order = MagicMock()
    order.user_id = user_id or uuid.uuid4()
    order.restaurant_id = restaurant_id or uuid.uuid4()
    return order


class TestCanReadOrder:
    @pytest.mark.asyncio
    async def test_customer_can_read_own_order(self):
        user = make_user()
        order = _order(user_id=user.id)

        assert await _can_read_order(AsyncMock(), order, user) is True

    @pytest.mark.asyncio
    async def test_customer_cannot_read_another_user_order(self):
        user = make_user()
        order = _order(user_id=uuid.uuid4())

        assert await _can_read_order(AsyncMock(), order, user) is False

    @pytest.mark.asyncio
    async def test_admin_can_read_any_order_without_restaurant_check(self):
        user = make_user(user_role=UserRole.ADMIN.value)
        order = _order(user_id=uuid.uuid4())

        with patch(
            "features.orders.api.ws.verify_restaurant_access",
            new_callable=AsyncMock,
        ) as verify_access:
            assert await _can_read_order(AsyncMock(), order, user) is True

        verify_access.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_restaurant_reader_must_have_restaurant_access(self):
        user = make_user(user_role=UserRole.STAFF.value)
        order = _order(user_id=uuid.uuid4())

        with patch(
            "features.orders.api.ws.verify_restaurant_access",
            new_callable=AsyncMock,
        ) as verify_access:
            assert await _can_read_order(AsyncMock(), order, user) is True

        verify_access.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_restaurant_reader_denied_when_access_check_fails(self):
        user = make_user(user_role=UserRole.STAFF.value)
        order = _order(user_id=uuid.uuid4())

        with patch(
            "features.orders.api.ws.verify_restaurant_access",
            new_callable=AsyncMock,
            side_effect=Exception("forbidden"),
        ):
            assert await _can_read_order(AsyncMock(), order, user) is False

    @pytest.mark.asyncio
    async def test_user_without_order_permissions_is_denied(self):
        user = make_user()
        user.permissions = [Permission.MENU_READ.value]
        order = _order(user_id=user.id)

        assert await _can_read_order(AsyncMock(), order, user) is False


def test_build_display_board_splits_cooking_and_ready_orders():
    rows = [
        (1001, OrderStatus.PENDING.value),
        (1002, OrderStatus.ACCEPTED.value),
        (1003, OrderStatus.READY.value),
        (1004, OrderStatus.COMPLETED.value),
        (1005, OrderStatus.CANCELLED.value),
    ]

    assert _build_display_board(rows) == {
        "cooking": [1001, 1002],
        "ready": [1003],
    }
