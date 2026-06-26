import secrets
import uuid

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from features.restaurants.models import Restaurant
from features.restaurants.schemas import RestaurantCreate, RestaurantUpdate
from shared.exceptions.existence import AlreadyExistsException

_DISPLAY_ID_GENERATION_ATTEMPTS = 8


async def _generate_unique_display_id(session: AsyncSession) -> str:
    for _ in range(_DISPLAY_ID_GENERATION_ATTEMPTS):
        display_id = secrets.token_hex(4)
        if await get_restaurant_by_display_id(session, display_id) is None:
            return display_id
    raise AlreadyExistsException(detail="Could not generate unique restaurant display id")


async def create_restaurant(
    session: AsyncSession, restaurant_data: RestaurantCreate, vendor_id: uuid.UUID
) -> Restaurant:
    display_id = await _generate_unique_display_id(session)
    new_restaurant = Restaurant(
        **restaurant_data.model_dump(), vendor_id=vendor_id, display_id=display_id
    )
    session.add(new_restaurant)
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise AlreadyExistsException(
            detail="Restaurant with this address or display id already exists"
        ) from e
    return new_restaurant


async def update_restaurant(
    session: AsyncSession, restaurant: Restaurant, update_data: RestaurantUpdate
) -> Restaurant:
    for key, value in update_data.model_dump(exclude_unset=True).items():
        setattr(restaurant, key, value)
    try:
        await session.commit()
    except IntegrityError as e:
        await session.rollback()
        raise AlreadyExistsException(detail="Restaurant with this address already exists") from e
    await session.refresh(restaurant)
    return restaurant


async def get_vendor_restaurants(
    session: AsyncSession,
    vendor_id: uuid.UUID,
    offset: int = 0,
    limit: int = 20,
) -> list[Restaurant]:
    result = await session.execute(
        select(Restaurant)
        .where(Restaurant.vendor_id == vendor_id)
        .order_by(Restaurant.id)
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def count_vendor_restaurants(session: AsyncSession, vendor_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count()).select_from(Restaurant).where(Restaurant.vendor_id == vendor_id)
    )
    return result.scalar_one()


async def get_restaurant_by_id(
    session: AsyncSession, restaurant_id: uuid.UUID
) -> Restaurant | None:
    return await session.get(Restaurant, restaurant_id)


async def get_restaurant_by_display_id(session: AsyncSession, display_id: str) -> Restaurant | None:
    stmt = select(Restaurant).where(Restaurant.display_id == display_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def count_restaurants(
    session: AsyncSession,
    name: str | None = None,
    is_hiring: bool | None = None,
    is_open: bool | None = None,
) -> int:
    stmt = select(func.count()).select_from(Restaurant)
    if name is not None:
        stmt = stmt.where(Restaurant.name.ilike(f"%{name}%"))
    if is_hiring is not None:
        stmt = stmt.where(Restaurant.is_hiring == is_hiring)
    if is_open is not None:
        stmt = stmt.where(Restaurant.is_open == is_open)
    result = await session.execute(stmt)
    return result.scalar_one()


async def get_all_restaurants(
    session: AsyncSession,
    name: str | None = None,
    is_hiring: bool | None = None,
    is_open: bool | None = None,
    offset: int = 0,
    limit: int = 20,
) -> list[Restaurant]:
    stmt = select(Restaurant)
    if name is not None:
        stmt = stmt.where(Restaurant.name.ilike(f"%{name}%"))
    if is_hiring is not None:
        stmt = stmt.where(Restaurant.is_hiring == is_hiring)
    if is_open is not None:
        stmt = stmt.where(Restaurant.is_open == is_open)
    stmt = stmt.order_by(Restaurant.name).offset(offset).limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())
