import pytest

from features.admin.crud import (
    count_all_orders,
    count_all_users,
    deactivate_user,
    get_all_orders,
    get_all_users,
    get_platform_stats,
    get_user_by_id,
)
from features.menu.models import MenuItem
from features.orders.models import Order, OrderItem
from features.restaurants.crud import create_restaurant
from features.restaurants.schemas import RestaurantCreate
from features.users.crud import create_user
from features.users.schemas import UserCreate
from features.vendors.crud import create_vendor_profile
from features.vendors.schemas import VendorCreate
from shared.enums.category import Category
from shared.enums.order_status import OrderStatus
from shared.enums.roles import UserRole
from shared.permissions import VENDOR_PERMISSIONS, serialize_permissions


@pytest.fixture
async def seeded_db(db_session):
    vendor_user = await create_user(
        db_session,
        UserCreate(
            name="VendorA",
            phone_number="79009001001",
            password="strongpassword",
        ),
    )
    vendor_user.permissions = serialize_permissions(VENDOR_PERMISSIONS)
    vendor_profile = await create_vendor_profile(db_session, vendor_user, VendorCreate())

    customer = await create_user(
        db_session,
        UserCreate(
            name="CustomerA",
            phone_number="79009001002",
            password="strongpassword",
        ),
    )

    restaurant = await create_restaurant(
        db_session,
        RestaurantCreate(name="Admin Test Rest", address="X"),
        vendor_profile.id,
    )

    menu_item = MenuItem(
        restaurant_id=restaurant.id,
        name="Dish",
        description="Yummy",
        price=300,
        category=Category.SHAURMA.value,
    )
    db_session.add(menu_item)
    await db_session.flush()

    order = Order(
        user_id=customer.id,
        restaurant_id=restaurant.id,
        total_price=300,
    )
    db_session.add(order)
    await db_session.flush()

    order_item = OrderItem(
        order_id=order.id,
        menu_item_id=menu_item.id,
        quantity=1,
        price_at_purchase=300,
    )
    db_session.add(order_item)
    await db_session.commit()

    return {
        "vendor_user": vendor_user,
        "customer": customer,
        "restaurant": restaurant,
        "order": order,
    }


@pytest.mark.asyncio
async def test_get_all_users_returns_all(db_session, seeded_db):
    users = await get_all_users(db_session)
    assert len(users) == 2


@pytest.mark.asyncio
async def test_get_all_users_filter_by_role(db_session, seeded_db):
    vendors = await get_all_users(db_session, role=UserRole.VENDOR)
    assert len(vendors) == 1
    assert vendors[0].id == seeded_db["vendor_user"].id

    customers = await get_all_users(db_session, role=UserRole.CUSTOMER)
    assert len(customers) == 1
    assert customers[0].id == seeded_db["customer"].id


@pytest.mark.asyncio
async def test_count_all_users(db_session, seeded_db):
    assert await count_all_users(db_session) == 2
    assert await count_all_users(db_session, role=UserRole.CUSTOMER) == 1


@pytest.mark.asyncio
async def test_get_user_by_id(db_session, seeded_db):
    customer = seeded_db["customer"]
    fetched = await get_user_by_id(db_session, customer.id)
    assert fetched is not None
    assert fetched.id == customer.id


@pytest.mark.asyncio
async def test_deactivate_user(db_session, seeded_db):
    customer = seeded_db["customer"]
    deactivated = await deactivate_user(db_session, customer)
    assert deactivated.is_active is False

    fetched = await get_user_by_id(db_session, customer.id)
    assert fetched.is_active is False


@pytest.mark.asyncio
async def test_get_all_orders(db_session, seeded_db):
    orders = await get_all_orders(db_session)
    assert len(orders) == 1
    assert orders[0].id == seeded_db["order"].id


@pytest.mark.asyncio
async def test_get_all_orders_filter_by_status(db_session, seeded_db):
    pending = await get_all_orders(db_session, status=OrderStatus.PENDING)
    assert len(pending) == 1

    accepted = await get_all_orders(db_session, status=OrderStatus.ACCEPTED)
    assert len(accepted) == 0


@pytest.mark.asyncio
async def test_count_all_orders(db_session, seeded_db):
    assert await count_all_orders(db_session) == 1
    assert await count_all_orders(db_session, status=OrderStatus.ACCEPTED) == 0


@pytest.mark.asyncio
async def test_get_platform_stats(db_session, seeded_db):
    stats = await get_platform_stats(db_session)

    assert stats.total_restaurants == 1
    assert isinstance(stats.users_by_role, dict)
    assert isinstance(stats.orders_by_status, dict)

    assert stats.users_by_role.get(UserRole.VENDOR.value, 0) == 1
    assert stats.users_by_role.get(UserRole.CUSTOMER.value, 0) == 1

    assert stats.orders_by_status.get(OrderStatus.PENDING.value, 0) == 1
