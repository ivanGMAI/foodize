import uuid

from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.auth.service import get_current_user
from features.orders.crud.order import get_order_by_id
from features.orders.models import Order
from features.restaurants.models import Restaurant
from features.staff.models import StaffProfile
from features.users.models import User
from features.vendors.crud import get_vendor_by_user_id
from shared.enums.permissions import Permission
from shared.exceptions import AccessDeniedException, NotFoundException
from shared.permissions import has_permission


async def verify_restaurant_access(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    current_user: User,
) -> Restaurant:
    restaurant = await session.get(Restaurant, restaurant_id)
    if not restaurant:
        raise NotFoundException(detail="Restaurant not found")

    if has_permission(current_user.permissions, Permission.ORDERS_MODERATE):
        return restaurant

    if not has_permission(current_user.permissions, Permission.ORDERS_READ_RESTAURANT):
        raise AccessDeniedException(detail="Only VENDOR and STAFF can access orders")

    if has_permission(current_user.permissions, Permission.VENDORS_READ_OWN):
        vendor = await get_vendor_by_user_id(session, current_user.id)
        if vendor and vendor.id == restaurant.vendor_id:
            return restaurant
        if vendor:
            raise AccessDeniedException(detail="Only VENDOR and STAFF can access orders")

    result = await session.execute(
        select(StaffProfile).where(
            StaffProfile.user_id == current_user.id,
            StaffProfile.restaurant_id == restaurant_id,
        )
    )
    if result.scalar_one_or_none():
        return restaurant

    raise AccessDeniedException(detail="Only VENDOR and STAFF can access orders")


async def get_restaurant_staff_or_vendor(
    restaurant_id: uuid.UUID,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
    current_user: User = Depends(get_current_user),
) -> Restaurant:
    return await verify_restaurant_access(session, restaurant_id, current_user)


async def get_order_for_staff_or_vendor(
    order_id: uuid.UUID,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
    current_user: User = Depends(get_current_user),
) -> Order:
    order = await get_order_by_id(session, order_id)
    if not order:
        raise NotFoundException(detail="Order not found")
    await verify_restaurant_access(session, order.restaurant_id, current_user)
    return order
