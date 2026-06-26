import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.menu.service import (
    add_menu_item,
    delete_menu_item_for_vendor,
    get_menu,
    update_menu_item_for_vendor,
)


def _mock_session() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    return session


class TestMenuService:
    @pytest.mark.asyncio
    async def test_get_menu(self):
        with (
            patch(
                "features.menu.crud.get_menu_items",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "features.menu.crud.count_menu_items",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            data, total = await get_menu(MagicMock(), uuid.uuid4())
            assert data == []
            assert total == 0

    @pytest.mark.asyncio
    async def test_get_menu_with_items(self):
        from shared.enums.category import Category

        restaurant_id = uuid.uuid4()
        item = MagicMock()
        item.id = uuid.uuid4()
        item.name = "Pizza"
        item.description = "Delicious"
        item.price = 1000
        item.restaurant_id = restaurant_id
        item.category = Category.PIZZA
        item.photo_url = "http://example.com/pizza.jpg"
        item.is_available = True
        item.prep_time_minutes = 15
        item.option_groups = []

        with (
            patch(
                "features.menu.crud.get_menu_items",
                new_callable=AsyncMock,
                return_value=[item],
            ),
            patch(
                "features.menu.crud.count_menu_items",
                new_callable=AsyncMock,
                return_value=1,
            ),
        ):
            data, total = await get_menu(MagicMock(), restaurant_id)
            assert len(data) == 1
            assert total == 1

    @pytest.mark.asyncio
    async def test_add_menu_item_success(self):
        from features.menu.schemas import MenuItemCreate
        from shared.enums.category import Category

        restaurant_id = uuid.uuid4()
        vendor_id = uuid.uuid4()
        item_data = MenuItemCreate(name="Burger", description="Tasty", price=800)
        item = MagicMock()
        item.id = uuid.uuid4()
        item.name = "Burger"
        item.description = "Tasty"
        item.price = 800
        item.restaurant_id = restaurant_id
        item.category = Category.BURGER
        item.photo_url = "http://example.com/burger.jpg"
        item.is_available = True
        item.prep_time_minutes = 15
        item.option_groups = []

        with (
            patch(
                "features.menu.service.get_restaurant_and_check_ownership",
                new_callable=AsyncMock,
            ),
            patch(
                "features.menu.crud.create_menu_item",
                new_callable=AsyncMock,
                return_value=item,
            ),
        ):
            result = await add_menu_item(_mock_session(), restaurant_id, item_data, vendor_id)
            assert result.name == "Burger"

    @pytest.mark.asyncio
    async def test_update_menu_item_success(self):
        from features.menu.schemas import MenuItemUpdate
        from shared.enums.category import Category

        restaurant_id = uuid.uuid4()
        vendor_id = uuid.uuid4()
        item_id = uuid.uuid4()
        update_data = MenuItemUpdate(name="Updated Burger")

        item = MagicMock()
        item.id = item_id
        item.name = "Burger"
        item.description = "Original"
        item.restaurant_id = restaurant_id
        item.is_deleted = False
        item.category = Category.BURGER
        item.photo_url = "http://example.com/burger.jpg"
        item.price = 800
        item.is_available = True
        item.prep_time_minutes = 15
        item.option_groups = []

        updated_item = MagicMock()
        updated_item.id = item_id
        updated_item.name = "Updated Burger"
        updated_item.description = "Original"
        updated_item.restaurant_id = restaurant_id
        updated_item.category = Category.BURGER
        updated_item.photo_url = "http://example.com/burger.jpg"
        updated_item.price = 800
        updated_item.is_available = True
        updated_item.prep_time_minutes = 15
        updated_item.option_groups = []

        with (
            patch(
                "features.menu.service.get_restaurant_and_check_ownership",
                new_callable=AsyncMock,
            ),
            patch(
                "features.menu.crud.get_menu_item_by_id",
                new_callable=AsyncMock,
                return_value=item,
            ),
            patch(
                "features.menu.crud.update_menu_item",
                new_callable=AsyncMock,
                return_value=updated_item,
            ),
        ):
            result = await update_menu_item_for_vendor(
                _mock_session(), restaurant_id, item_id, update_data, vendor_id
            )
            assert result.name == "Updated Burger"

    @pytest.mark.asyncio
    async def test_delete_menu_item_success(self):
        restaurant_id = uuid.uuid4()
        vendor_id = uuid.uuid4()
        item_id = uuid.uuid4()
        item = MagicMock(id=item_id, restaurant_id=restaurant_id, is_deleted=False)
        item.name = "Burger"

        with (
            patch(
                "features.menu.service.get_restaurant_and_check_ownership",
                new_callable=AsyncMock,
            ),
            patch(
                "features.menu.crud.get_menu_item_by_id",
                new_callable=AsyncMock,
                return_value=item,
            ),
            patch("features.menu.crud.delete_menu_item", new_callable=AsyncMock),
        ):
            await delete_menu_item_for_vendor(_mock_session(), restaurant_id, item_id, vendor_id)

    @pytest.mark.asyncio
    async def test_delete_menu_item_not_found(self):
        from features.menu.exceptions import MenuItemNotFoundException

        restaurant_id = uuid.uuid4()
        vendor_id = uuid.uuid4()
        item_id = uuid.uuid4()

        with (
            patch(
                "features.menu.service.get_restaurant_and_check_ownership",
                new_callable=AsyncMock,
            ),
            patch(
                "features.menu.crud.get_menu_item_by_id",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            with pytest.raises(MenuItemNotFoundException):
                await delete_menu_item_for_vendor(MagicMock(), restaurant_id, item_id, vendor_id)
