import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from features.restaurants.exceptions import RestaurantNotFoundException
from features.restaurants.service import (
    get_all_restaurants_public,
    get_restaurant_public,
)
from shared.enums.moderation_status import ModerationStatus


def _make_row(restaurant_id: uuid.UUID | None = None, vendor_id: uuid.UUID | None = None):
    restaurant = MagicMock()
    restaurant.id = restaurant_id or uuid.uuid4()
    restaurant.vendor_id = vendor_id or uuid.uuid4()
    restaurant.display_id = "test-cafe"
    restaurant.name = "Test Cafe"
    restaurant.address = "Test Street 1"
    restaurant.description = None
    restaurant.photo_url = None
    restaurant.is_hiring = True
    restaurant.is_open = True
    restaurant.moderation_status = ModerationStatus.APPROVED.value
    restaurant.rejection_reason = None
    return [restaurant, 10]


def _empty_working_hours_result():
    result = MagicMock()
    result.scalars.return_value.all.return_value = []
    return result


class TestGetRestaurantPublic:
    @pytest.mark.asyncio
    async def test_success(self):
        row = _make_row()
        mock_result = MagicMock()
        mock_result.one_or_none = MagicMock(return_value=row)

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[mock_result, _empty_working_hours_result()])

        result = await get_restaurant_public(session, row[0].id)
        assert result.id == row[0].id
        assert result.orders_count_7d == 10

    @pytest.mark.asyncio
    async def test_success_by_display_id(self):
        row = _make_row()
        mock_result = MagicMock()
        mock_result.one_or_none = MagicMock(return_value=row)

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[mock_result, _empty_working_hours_result()])

        result = await get_restaurant_public(session, "test-cafe")

        assert result.id == row[0].id
        assert result.display_id == "test-cafe"

    @pytest.mark.asyncio
    async def test_not_found(self):
        mock_result = MagicMock()
        mock_result.one_or_none = MagicMock(return_value=None)

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(RestaurantNotFoundException):
            await get_restaurant_public(session, uuid.uuid4())


class TestGetAllRestaurantsPublic:
    @pytest.mark.asyncio
    async def test_success_no_filters(self):
        row = _make_row()
        mock_result = MagicMock()
        mock_result.all = MagicMock(return_value=[row])

        mock_count_result = MagicMock()
        mock_count_result.scalar_one = MagicMock(return_value=1)

        session = AsyncMock()
        session.execute = AsyncMock(
            side_effect=[mock_result, _empty_working_hours_result(), mock_count_result]
        )

        data, total = await get_all_restaurants_public(session)
        assert len(data) == 1
        assert total == 1

    @pytest.mark.asyncio
    async def test_with_name_filter(self):
        row = _make_row()
        mock_result = MagicMock()
        mock_result.all = MagicMock(return_value=[row])

        mock_count_result = MagicMock()
        mock_count_result.scalar_one = MagicMock(return_value=1)

        session = AsyncMock()
        session.execute = AsyncMock(
            side_effect=[mock_result, _empty_working_hours_result(), mock_count_result]
        )

        data, total = await get_all_restaurants_public(session, name="Cafe")
        assert len(data) == 1
        assert total == 1

    @pytest.mark.asyncio
    async def test_with_hiring_filter(self):
        mock_result = MagicMock()
        mock_result.all = MagicMock(return_value=[])

        mock_count_result = MagicMock()
        mock_count_result.scalar_one = MagicMock(return_value=0)

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[mock_result, mock_count_result])

        data, total = await get_all_restaurants_public(session, is_hiring=True, is_open=False)
        assert data == []
        assert total == 0

    @pytest.mark.asyncio
    async def test_empty_result(self):
        mock_result = MagicMock()
        mock_result.all = MagicMock(return_value=[])

        mock_count_result = MagicMock()
        mock_count_result.scalar_one = MagicMock(return_value=0)

        session = AsyncMock()
        session.execute = AsyncMock(side_effect=[mock_result, mock_count_result])

        data, total = await get_all_restaurants_public(session)
        assert data == []
        assert total == 0
