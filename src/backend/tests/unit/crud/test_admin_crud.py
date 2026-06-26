import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from features.admin.crud import activate_user, count_all_orders, get_all_orders
from shared.enums.order_status import OrderStatus


class TestActivateUser:
    @pytest.mark.asyncio
    async def test_activates_user(self):
        user = MagicMock()
        user.is_active = False

        session = AsyncMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()

        result = await activate_user(session, user)
        assert user.is_active is True
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once_with(user)
        assert result == user


class TestGetAllOrders:
    @pytest.mark.asyncio
    async def test_with_all_filters(self):
        mock_result = MagicMock()
        mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await get_all_orders(
            session,
            status=OrderStatus.PENDING,
            restaurant_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
        )
        assert result == []
        session.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_without_filters(self):
        mock_result = MagicMock()
        mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await get_all_orders(session)
        assert result == []


class TestCountAllOrders:
    @pytest.mark.asyncio
    async def test_with_all_filters(self):
        mock_result = MagicMock()
        mock_result.scalar_one = MagicMock(return_value=5)

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await count_all_orders(
            session,
            status=OrderStatus.COMPLETED,
            restaurant_id=uuid.uuid4(),
            user_id=uuid.uuid4(),
        )
        assert result == 5

    @pytest.mark.asyncio
    async def test_without_filters(self):
        mock_result = MagicMock()
        mock_result.scalar_one = MagicMock(return_value=10)

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await count_all_orders(session)
        assert result == 10
