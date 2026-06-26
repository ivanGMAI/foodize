import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.restaurants.schemas import (
    RestaurantCreate,
    RestaurantResponse,
    RestaurantUpdate,
)
from features.restaurants.service import (
    create_restaurant_for_vendor,
    get_my_restaurants,
    update_restaurant_for_vendor,
)
from shared.enums.moderation_status import ModerationStatus
from shared.exceptions.existence import NotFoundException


def make_mock_restaurant(
    restaurant_id: uuid.UUID | None = None, vendor_id: uuid.UUID | None = None
):
    r = MagicMock()
    r.id = restaurant_id or uuid.uuid4()
    r.vendor_id = vendor_id or uuid.uuid4()
    r.display_id = "test-restaurant"
    r.name = "Test Restaurant"
    r.address = "Test Street 1"
    r.description = None
    r.photo_url = None
    r.is_hiring = True
    r.is_open = True
    r.moderation_status = ModerationStatus.PENDING.value
    r.rejection_reason = None
    return r


class TestCreateRestaurantForVendor:
    async def test_creates_restaurant(self, mock_db_session):
        vendor_id = uuid.uuid4()
        mock_restaurant = make_mock_restaurant(vendor_id=vendor_id)
        restaurant_data = RestaurantCreate(name="Sushi Bar", address="Lenin St 1")
        mock_vendor = MagicMock()
        mock_vendor.approval_status = ModerationStatus.APPROVED.value
        mock_vendor.user.permissions = []
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_vendor

        with (
            patch.object(mock_db_session, "execute", new=AsyncMock(return_value=mock_result)),
            patch(
                "features.restaurants.crud.create_restaurant",
                new_callable=AsyncMock,
                return_value=mock_restaurant,
            ) as mock_create,
        ):
            result = await create_restaurant_for_vendor(mock_db_session, restaurant_data, vendor_id)

        assert isinstance(result, RestaurantResponse)
        assert result.id == mock_restaurant.id
        mock_create.assert_awaited_once_with(mock_db_session, restaurant_data, vendor_id)


class TestUpdateRestaurantForVendor:
    async def test_update_success(self, mock_db_session):
        vendor_id = uuid.uuid4()
        restaurant_id = uuid.uuid4()
        mock_restaurant = make_mock_restaurant(restaurant_id, vendor_id)
        update_data = RestaurantUpdate(name="New Name")

        with (
            patch(
                "features.restaurants.service.get_restaurant_and_check_ownership",
                new_callable=AsyncMock,
                return_value=mock_restaurant,
            ),
            patch(
                "features.restaurants.crud.update_restaurant",
                new_callable=AsyncMock,
                return_value=mock_restaurant,
            ) as mock_update,
        ):
            result = await update_restaurant_for_vendor(
                mock_db_session, restaurant_id, update_data, vendor_id
            )

        assert isinstance(result, RestaurantResponse)
        assert result.id == mock_restaurant.id
        mock_update.assert_awaited_once_with(mock_db_session, mock_restaurant, update_data)

    async def test_update_wrong_vendor_raises(self, mock_db_session):
        with patch(
            "features.restaurants.service.get_restaurant_and_check_ownership",
            new_callable=AsyncMock,
            side_effect=NotFoundException(),
        ):
            with pytest.raises(NotFoundException):
                await update_restaurant_for_vendor(
                    mock_db_session,
                    uuid.uuid4(),
                    RestaurantUpdate(name="x"),
                    uuid.uuid4(),
                )


class TestGetMyRestaurants:
    async def test_returns_vendor_restaurants(self, mock_db_session):
        vendor_id = uuid.uuid4()
        restaurants = [make_mock_restaurant(vendor_id=vendor_id) for _ in range(2)]

        with (
            patch(
                "features.restaurants.crud.get_vendor_restaurants",
                new_callable=AsyncMock,
                return_value=restaurants,
            ),
            patch(
                "features.restaurants.crud.count_vendor_restaurants",
                new_callable=AsyncMock,
                return_value=2,
            ),
        ):
            data, total = await get_my_restaurants(mock_db_session, vendor_id)

        assert len(data) == 2
        assert total == 2

    async def test_returns_empty_when_no_restaurants(self, mock_db_session):
        with (
            patch(
                "features.restaurants.crud.get_vendor_restaurants",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "features.restaurants.crud.count_vendor_restaurants",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            data, total = await get_my_restaurants(mock_db_session, uuid.uuid4())

        assert data == []
        assert total == 0
