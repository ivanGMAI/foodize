import pytest

from features.menu.crud import (
    count_menu_items,
    create_menu_item,
    create_option,
    create_option_group,
    delete_menu_item,
    delete_option,
    delete_option_group,
    get_menu_item_by_id,
    get_menu_items,
    update_menu_item,
    update_option,
    update_option_group,
)
from features.menu.schemas import (
    MenuItemCreate,
    MenuItemOptionCreate,
    MenuItemOptionGroupCreate,
    MenuItemOptionGroupUpdate,
    MenuItemOptionUpdate,
    MenuItemResponse,
    MenuItemUpdate,
)
from features.restaurants.crud import create_restaurant
from features.restaurants.schemas import RestaurantCreate
from features.users.crud import create_user
from features.users.schemas import UserCreate
from features.vendors.crud import create_vendor_profile
from features.vendors.schemas import VendorCreate
from shared.enums.category import Category
from shared.enums.roles import UserRole


@pytest.fixture
async def restaurant(db_session):
    vendor_data = UserCreate(
        name="Vendor3",
        phone_number="79006666666",
        password="strongpassword",
        user_role=UserRole.VENDOR,
    )
    vendor_user = await create_user(db_session, vendor_data)
    vendor_profile = await create_vendor_profile(db_session, vendor_user, VendorCreate())
    rest_data = RestaurantCreate(name="Rest3", address="Addr3")
    return await create_restaurant(db_session, rest_data, vendor_profile.id)


@pytest.mark.asyncio
async def test_create_and_get_menu_item(db_session, restaurant):
    item_create = MenuItemCreate(
        name="Sushi", description="Fish", price=800, category=Category.SHAURMA
    )

    new_item = await create_menu_item(db_session, item_create, restaurant.id)
    assert new_item.id is not None
    assert new_item.name == "Sushi"
    assert new_item.price == 800
    assert not new_item.is_deleted

    fetched = await get_menu_item_by_id(db_session, new_item.id)
    assert fetched is not None
    assert fetched.id == new_item.id

    items = await get_menu_items(db_session, restaurant.id)
    assert len(items) == 1
    assert items[0].name == "Sushi"

    count = await count_menu_items(db_session, restaurant.id)
    assert count == 1

    response = MenuItemResponse.model_validate(new_item)
    assert response.option_groups == []


@pytest.mark.asyncio
async def test_update_menu_item(db_session, restaurant):
    item = await create_menu_item(
        db_session,
        MenuItemCreate(name="Old Name", price=100, category=Category.SHAURMA),
        restaurant.id,
    )

    updated = await update_menu_item(
        db_session,
        item,
        MenuItemUpdate(name="New Name", price=200),
    )

    assert updated.name == "New Name"
    assert updated.price == 200
    assert updated.category == Category.SHAURMA.value


@pytest.mark.asyncio
async def test_delete_menu_item_soft_deletes(db_session, restaurant):
    item = await create_menu_item(
        db_session,
        MenuItemCreate(name="To Delete", price=50, category=Category.SHAURMA),
        restaurant.id,
    )

    await delete_menu_item(db_session, item)

    items = await get_menu_items(db_session, restaurant.id)
    assert len(items) == 0

    count = await count_menu_items(db_session, restaurant.id)
    assert count == 0

    fetched = await get_menu_item_by_id(db_session, item.id)
    assert fetched is not None
    assert fetched.is_deleted is True


@pytest.mark.asyncio
async def test_menu_item_option_group_crud(db_session, restaurant):
    item = await create_menu_item(
        db_session,
        MenuItemCreate(name="Burger", price=300, category=Category.SHAURMA),
        restaurant.id,
    )

    group = await create_option_group(
        db_session,
        item,
        MenuItemOptionGroupCreate(
            name="Add-ons",
            selection_type="multiple",
            max_selected=2,
            options=[
                MenuItemOptionCreate(name="Cheese", price_delta=50),
                MenuItemOptionCreate(name="Double meat", price_delta=180),
            ],
        ),
    )

    assert group.id is not None
    assert len(group.options) == 2
    assert group.options[0].name == "Cheese"

    updated_group = await update_option_group(
        db_session,
        group,
        MenuItemOptionGroupUpdate(name="Extras", max_selected=3),
    )
    assert updated_group.name == "Extras"
    assert updated_group.max_selected == 3

    option = await create_option(
        db_session,
        group,
        MenuItemOptionCreate(name="Hot sauce", price_delta=30),
    )
    updated_option = await update_option(
        db_session,
        option,
        MenuItemOptionUpdate(price_delta=40),
    )
    assert updated_option.price_delta == 40

    await delete_option(db_session, updated_option)
    assert updated_option.is_available is False

    await delete_option_group(db_session, updated_group)
    assert updated_group.is_active is False
