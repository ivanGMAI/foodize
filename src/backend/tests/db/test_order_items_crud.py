import pytest

from features.menu.models import MenuItem
from features.orders.services.order_item import get_menu_items_by_ids
from features.restaurants.crud import create_restaurant
from features.restaurants.schemas import RestaurantCreate
from features.users.crud import create_user
from features.users.schemas import UserCreate
from features.vendors.crud import create_vendor_profile
from features.vendors.schemas import VendorCreate
from shared.enums.category import Category
from shared.enums.roles import UserRole


@pytest.mark.asyncio
async def test_get_menu_items_by_ids(db_session):
    vendor_data = UserCreate(
        name="Vendor2",
        phone_number="79005555555",
        password="strongpassword",
        user_role=UserRole.VENDOR,
    )
    vendor_user = await create_user(db_session, vendor_data)
    vendor_profile = await create_vendor_profile(db_session, vendor_user, VendorCreate())

    rest_data = RestaurantCreate(name="Rest2", address="Addr2")
    restaurant = await create_restaurant(db_session, rest_data, vendor_profile.id)

    m1 = MenuItem(
        restaurant_id=restaurant.id,
        name="Item1",
        description="desc",
        price=100,
        category=Category.SHAURMA.value,
    )
    m2 = MenuItem(
        restaurant_id=restaurant.id,
        name="Item2",
        description="desc",
        price=200,
        category=Category.SHAURMA.value,
    )
    db_session.add_all([m1, m2])
    await db_session.commit()

    items_map = await get_menu_items_by_ids(db_session, [m1.id, m2.id])
    assert len(items_map) == 2
    assert m1.id in items_map
    assert m2.id in items_map
    assert items_map[m1.id].name == "Item1"
