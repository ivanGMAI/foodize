import uuid
from collections.abc import Sequence
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from features.admin import crud
from features.admin.audit_log import service as audit_service
from features.admin.schemas import (
    AdminRestaurantResponse,
    AdminReviewResponse,
    AdminVendorResponse,
    AdvancedAnalytics,
    FinanceAnalytics,
    PlatformStats,
)
from features.orders.models import Order
from features.restaurants.models import Restaurant
from features.users.models import User
from shared.enums.order_status import OrderStatus
from shared.enums.permissions import Permission
from shared.exceptions import NotFoundException
from shared.permissions import serialize_permissions


async def get_users_list(
    session: AsyncSession,
    role: str | None,
    offset: int,
    limit: int,
    search: str | None = None,
) -> tuple[list[User], int]:
    data = await crud.get_all_users(session, role=role, search=search, offset=offset, limit=limit)
    total = await crud.count_all_users(session, role=role, search=search)
    return data, total


async def get_user_or_404(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await crud.get_user_by_id(session, user_id)
    if not user:
        raise NotFoundException()
    return user


async def deactivate_user_service(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await get_user_or_404(session, user_id)
    return await crud.deactivate_user(session, user)


async def activate_user_service(session: AsyncSession, user_id: uuid.UUID) -> User:
    user = await get_user_or_404(session, user_id)
    return await crud.activate_user(session, user)


async def set_user_permissions(
    session: AsyncSession,
    user_id: uuid.UUID,
    permissions: Sequence[Permission | str],
    actor_id: uuid.UUID | None = None,
) -> User:
    user = await get_user_or_404(session, user_id)
    old_permissions = user.permissions
    user.permissions = serialize_permissions(permissions)
    await session.commit()
    await session.refresh(user)

    await audit_service.log_action(
        session,
        actor_id=actor_id,
        action="UPDATE_PERMISSIONS",
        entity_type="user",
        entity_id=user.id,
        details={"old": old_permissions, "new": user.permissions},
    )
    await session.commit()
    return user


async def get_orders_list(
    session: AsyncSession,
    status: OrderStatus | None = None,
    restaurant_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[Order], int]:
    data = await crud.get_all_orders(
        session,
        status=status,
        restaurant_id=restaurant_id,
        user_id=user_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        offset=offset,
        limit=limit,
    )
    total = await crud.count_all_orders(
        session,
        status=status,
        restaurant_id=restaurant_id,
        user_id=user_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
    )
    return data, total


async def get_restaurants_list(
    session: AsyncSession,
    search: str | None = None,
    vendor_search: str | None = None,
    is_open: bool | None = None,
    moderation_status: str | None = None,
    min_rating: float | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[AdminRestaurantResponse], int]:
    data = await crud.get_all_restaurants(
        session,
        search=search,
        vendor_search=vendor_search,
        is_open=is_open,
        moderation_status=moderation_status,
        min_rating=min_rating,
        offset=offset,
        limit=limit,
    )
    total = await crud.count_all_restaurants(
        session,
        search=search,
        vendor_search=vendor_search,
        is_open=is_open,
        moderation_status=moderation_status,
        min_rating=min_rating,
    )
    return data, total


async def get_restaurant_or_404(
    session: AsyncSession, restaurant_id: uuid.UUID
) -> AdminRestaurantResponse:
    restaurant = await crud.get_restaurant_by_id(session, restaurant_id)
    if not restaurant:
        raise NotFoundException()
    return restaurant


async def delete_restaurant_service(
    session: AsyncSession, restaurant_id: uuid.UUID
) -> AdminRestaurantResponse:
    restaurant = await get_restaurant_or_404(session, restaurant_id)
    await crud.deactivate_restaurant(session, restaurant_id)
    return restaurant


async def get_vendors_list(
    session: AsyncSession,
    search: str | None = None,
    approval_status: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[AdminVendorResponse], int]:
    vendors = await crud.get_all_vendors(
        session,
        search=search,
        approval_status=approval_status,
        offset=offset,
        limit=limit,
    )
    total = await crud.count_all_vendors(session, search=search, approval_status=approval_status)
    return [AdminVendorResponse.model_validate(vendor) for vendor in vendors], total


async def get_vendor_or_404(session: AsyncSession, vendor_id: uuid.UUID) -> AdminVendorResponse:
    vendor = await crud.get_vendor_by_id(session, vendor_id)
    if not vendor:
        raise NotFoundException()
    return AdminVendorResponse.model_validate(vendor)


async def delete_vendor_service(session: AsyncSession, vendor_id: uuid.UUID) -> AdminVendorResponse:
    vendor = await crud.get_vendor_by_id(session, vendor_id)
    if not vendor:
        raise NotFoundException()
    response = AdminVendorResponse.model_validate(vendor)
    await crud.deactivate_vendor(session, vendor)
    return response


async def get_reviews_list(
    session: AsyncSession,
    rating: int | None = None,
    offset: int = 0,
    limit: int = 20,
) -> tuple[list[AdminReviewResponse], int]:
    data = await crud.get_all_reviews(session, rating=rating, offset=offset, limit=limit)
    total = await crud.count_all_reviews(session, rating=rating)
    return data, total


async def delete_review_service(session: AsyncSession, review_id: uuid.UUID) -> AdminReviewResponse:
    review = await crud.get_review_by_id(session, review_id)
    if not review:
        raise NotFoundException()
    deleted = await crud.delete_review(session, review)
    return AdminReviewResponse.model_validate(deleted)


async def get_stats(session: AsyncSession) -> PlatformStats:
    return await crud.get_platform_stats(session)


async def get_finance(
    session: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
    vendor_id: uuid.UUID | None = None,
    restaurant_id: uuid.UUID | None = None,
) -> FinanceAnalytics:
    return await crud.get_finance_analytics(
        session,
        date_from=date_from,
        date_to=date_to,
        vendor_id=vendor_id,
        restaurant_id=restaurant_id,
    )


async def get_advanced_analytics(
    session: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
    vendor_id: uuid.UUID | None = None,
    restaurant_id: uuid.UUID | None = None,
) -> AdvancedAnalytics:
    return await crud.get_advanced_analytics(
        session,
        date_from=date_from,
        date_to=date_to,
        vendor_id=vendor_id,
        restaurant_id=restaurant_id,
    )


async def moderate_vendor(
    session: AsyncSession,
    vendor_id: uuid.UUID,
    status: str,
    reason: str | None = None,
    actor_id: uuid.UUID | None = None,
) -> AdminVendorResponse:
    vendor = await crud.get_vendor_by_id(session, vendor_id)
    if not vendor:
        raise NotFoundException()
    old_status = vendor.approval_status
    updated = await crud.set_vendor_moderation(session, vendor, status, reason)

    await audit_service.log_action(
        session,
        actor_id=actor_id,
        action="MODERATE_VENDOR",
        entity_type="vendor",
        entity_id=vendor_id,
        details={"old": old_status, "new": status, "reason": reason},
    )
    await session.commit()
    return AdminVendorResponse.model_validate(updated)


async def moderate_restaurant(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    status: str,
    reason: str | None = None,
    actor_id: uuid.UUID | None = None,
) -> AdminRestaurantResponse:
    restaurant = await session.get(Restaurant, restaurant_id)
    if not restaurant or not restaurant.is_active:
        raise NotFoundException()
    old_status = restaurant.moderation_status
    updated = await crud.set_restaurant_moderation(session, restaurant, status, reason)

    await audit_service.log_action(
        session,
        actor_id=actor_id,
        action="MODERATE_RESTAURANT",
        entity_type="restaurant",
        entity_id=restaurant_id,
        details={"old": old_status, "new": status, "reason": reason},
    )
    await session.commit()
    return await get_restaurant_or_404(session, updated.id)
