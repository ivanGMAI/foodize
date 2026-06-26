import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from features.orders.models.order import Order
from features.restaurants import crud
from features.restaurants.dependencies import get_restaurant_and_check_ownership
from features.restaurants.exceptions import RestaurantNotFoundException
from features.restaurants.models import Restaurant
from features.restaurants.schemas import (
    RestaurantCreate,
    RestaurantResponse,
    RestaurantUpdate,
)
from features.restaurants.working_hours import WorkingHours
from features.restaurants.working_hours_crud import get_working_hours, is_open_now
from features.vendors.models import VendorProfile
from shared.enums.moderation_status import ModerationStatus
from shared.enums.permissions import Permission
from shared.enums.restaurant_sort import RestaurantSort
from shared.enums.sort_direction import SortDirection
from shared.exceptions.rules import AccessDeniedException
from shared.permissions import has_permission


async def create_restaurant_for_vendor(
    session: AsyncSession, restaurant_data: RestaurantCreate, vendor_id: uuid.UUID
) -> RestaurantResponse:
    vendor = (
        await session.execute(
            select(VendorProfile)
            .where(VendorProfile.id == vendor_id)
            .options(selectinload(VendorProfile.user))
        )
    ).scalar_one_or_none()
    if not vendor:
        raise AccessDeniedException()
    if vendor.approval_status != ModerationStatus.APPROVED.value:
        raise AccessDeniedException(detail="Vendor account is not approved yet")

    restaurant = await crud.create_restaurant(session, restaurant_data, vendor_id)
    if vendor and has_permission(vendor.user.permissions, Permission.RESTAURANTS_MODERATE):
        restaurant.moderation_status = ModerationStatus.APPROVED.value
        restaurant.rejection_reason = None
        await session.commit()
        await session.refresh(restaurant)
    return RestaurantResponse.model_validate(restaurant)


async def update_restaurant_for_vendor(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    update_data: RestaurantUpdate,
    vendor_id: uuid.UUID,
) -> RestaurantResponse:
    restaurant = await get_restaurant_and_check_ownership(
        session=session, restaurant_id=restaurant_id, vendor_id=vendor_id
    )
    updated = await crud.update_restaurant(session, restaurant, update_data)
    return RestaurantResponse.model_validate(updated)


async def get_my_restaurants(
    session: AsyncSession,
    vendor_id: uuid.UUID,
    page: int = 1,
    size: int = 20,
) -> tuple[list[RestaurantResponse], int]:
    offset = (page - 1) * size
    data = await crud.get_vendor_restaurants(session, vendor_id, offset=offset, limit=size)
    total = await crud.count_vendor_restaurants(session, vendor_id)
    return [RestaurantResponse.model_validate(r) for r in data], total


def _apply_restaurant_filters(
    query,
    name: str | None,
    is_hiring: bool | None,
    is_open: bool | None,
):
    query = query.where(Restaurant.is_active.is_(True))
    if name:
        query = query.where(Restaurant.name.ilike(f"%{name}%"))
    if is_hiring is not None:
        query = query.where(Restaurant.is_hiring == is_hiring)
    if is_open is not None:
        query = query.where(Restaurant.is_open == is_open)
    query = query.where(Restaurant.moderation_status == ModerationStatus.APPROVED.value)
    return query


async def get_restaurant_public(
    session: AsyncSession,
    identifier: str | uuid.UUID,
) -> RestaurantResponse:
    try:
        if isinstance(identifier, str):
            parsed_uuid = uuid.UUID(identifier)
        else:
            parsed_uuid = identifier
        where_clause = Restaurant.id == parsed_uuid
    except ValueError:
        where_clause = Restaurant.display_id == str(identifier)

    since = datetime.now(timezone.utc) - timedelta(days=7)
    popularity_subquery = (
        select(Order.restaurant_id, func.count(Order.id).label("orders_count_7d"))
        .where(Order.created_at >= since)
        .group_by(Order.restaurant_id)
        .subquery()
    )
    result = await session.execute(
        _apply_restaurant_filters(
            select(
                Restaurant,
                func.coalesce(popularity_subquery.c.orders_count_7d, 0).label("orders_count_7d"),
            )
            .outerjoin(
                popularity_subquery,
                popularity_subquery.c.restaurant_id == Restaurant.id,
            )
            .where(where_clause),
            None,
            None,
            None,
        )
    )
    row = result.one_or_none()
    if not row:
        raise RestaurantNotFoundException()
    restaurant = row[0]
    restaurant.orders_count_7d = int(row[1] or 0)
    response = RestaurantResponse.model_validate(restaurant)

    if response.is_open:
        wh = await get_working_hours(session, response.id)
        if wh and is_open_now(wh) is False:
            response.is_open = False

    return response


async def get_all_restaurants_public(
    session: AsyncSession,
    name: str | None = None,
    is_hiring: bool | None = None,
    is_open: bool | None = None,
    sort: str = RestaurantSort.DEFAULT.value,
    direction: str = SortDirection.DESC.value,
    page: int = 1,
    size: int = 20,
) -> tuple[list[RestaurantResponse], int]:
    offset = (page - 1) * size
    since = datetime.now(timezone.utc) - timedelta(days=7)
    popularity_subquery = (
        select(Order.restaurant_id, func.count(Order.id).label("orders_count_7d"))
        .where(Order.created_at >= since)
        .group_by(Order.restaurant_id)
        .subquery()
    )
    popularity_expr = func.coalesce(popularity_subquery.c.orders_count_7d, 0)

    query = _apply_restaurant_filters(
        select(Restaurant, popularity_expr.label("orders_count_7d")).outerjoin(
            popularity_subquery,
            popularity_subquery.c.restaurant_id == Restaurant.id,
        ),
        name,
        is_hiring,
        is_open,
    )
    sort_direction = asc if direction == SortDirection.ASC.value else desc
    if sort == RestaurantSort.RATING.value:
        query = query.order_by(sort_direction(Restaurant.average_rating), Restaurant.name)
    elif sort == RestaurantSort.POPULARITY_7D.value:
        query = query.order_by(sort_direction(popularity_expr), Restaurant.name)
    else:
        query = query.order_by(Restaurant.name)
    result = await session.execute(query.offset(offset).limit(size))
    restaurants = []
    rest_ids = []
    for row in result.all():
        restaurant = row[0]
        restaurant.orders_count_7d = int(row[1] or 0)
        rest_ids.append(restaurant.id)
        restaurants.append(RestaurantResponse.model_validate(restaurant))

    if rest_ids:
        wh_result = await session.execute(
            select(WorkingHours).where(WorkingHours.restaurant_id.in_(rest_ids))
        )
        wh_rows = wh_result.scalars().all()
        wh_map: dict[uuid.UUID, list[WorkingHours]] = {}
        for wh in wh_rows:
            wh_map.setdefault(wh.restaurant_id, []).append(wh)

        for r in restaurants:
            if r.is_open:
                hours = wh_map.get(r.id)
                if hours and is_open_now(hours) is False:
                    r.is_open = False

    total_query = _apply_restaurant_filters(
        select(func.count(Restaurant.id)), name, is_hiring, is_open
    )
    total = (await session.execute(total_query)).scalar_one()

    return restaurants, total
