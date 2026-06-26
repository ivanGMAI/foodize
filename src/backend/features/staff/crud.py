import uuid

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from features.restaurants.models import Restaurant
from features.staff.models import StaffProfile, StaffRequest
from features.staff.schemas import StaffRequestCreate
from features.users.models import User
from shared.enums.staff_request_status import StaffRequestStatus
from shared.enums.staff_roles import StaffRole
from shared.permissions import STAFF_PERMISSIONS, permissions_with, permissions_without


async def create_staff_request(
    session: AsyncSession,
    user_id: uuid.UUID,
    restaurant_id: uuid.UUID,
    data: StaffRequestCreate,
) -> StaffRequest:
    new_request = StaffRequest(user_id=user_id, restaurant_id=restaurant_id, message=data.message)
    session.add(new_request)
    await session.commit()
    await session.refresh(new_request)
    return new_request


async def get_last_request(
    session: AsyncSession, user_id: uuid.UUID, restaurant_id: uuid.UUID
) -> StaffRequest | None:
    result = await session.execute(
        select(StaffRequest)
        .where(
            and_(
                StaffRequest.user_id == user_id,
                StaffRequest.restaurant_id == restaurant_id,
            )
        )
        .order_by(StaffRequest.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_staff_profile_by_user_id(
    session: AsyncSession, user_id: uuid.UUID
) -> StaffProfile | None:
    result = await session.execute(select(StaffProfile).where(StaffProfile.user_id == user_id))
    return result.scalar_one_or_none()


async def get_request_by_id(session: AsyncSession, request_id: uuid.UUID) -> StaffRequest | None:
    return await session.get(StaffRequest, request_id)


async def get_last_request_by_user(
    session: AsyncSession, user_id: uuid.UUID
) -> StaffRequest | None:
    result = await session.execute(
        select(StaffRequest)
        .where(StaffRequest.user_id == user_id)
        .order_by(StaffRequest.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_requests_by_vendor_id(
    session: AsyncSession,
    vendor_id: uuid.UUID,
    offset: int = 0,
    limit: int = 20,
) -> list[StaffRequest]:
    result = await session.execute(
        select(StaffRequest)
        .join(Restaurant)
        .where(Restaurant.vendor_id == vendor_id)
        .order_by(StaffRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def count_requests_by_vendor_id(session: AsyncSession, vendor_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(StaffRequest)
        .join(Restaurant)
        .where(Restaurant.vendor_id == vendor_id)
    )
    return result.scalar_one()


async def update_request_status(
    session: AsyncSession, request: StaffRequest, new_status: StaffRequestStatus
) -> StaffRequest:
    request.status = new_status.value
    await session.commit()
    await session.refresh(request)
    return request


async def create_staff_profile(
    session: AsyncSession, user_id: uuid.UUID, restaurant_id: uuid.UUID
) -> StaffProfile:
    user = await session.get(User, user_id)
    if user:
        user.permissions = permissions_with(user.permissions, STAFF_PERMISSIONS)

    profile = StaffProfile(user_id=user_id, restaurant_id=restaurant_id, role=StaffRole.COOK.value)
    session.add(profile)
    await session.commit()
    return profile


async def get_staff_profiles_by_vendor_id(
    session: AsyncSession,
    vendor_id: uuid.UUID,
    offset: int = 0,
    limit: int = 20,
) -> list[StaffProfile]:
    result = await session.execute(
        select(StaffProfile)
        .join(Restaurant, StaffProfile.restaurant_id == Restaurant.id)
        .where(Restaurant.vendor_id == vendor_id)
        .options(selectinload(StaffProfile.user), selectinload(StaffProfile.restaurant))
        .order_by(StaffProfile.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def count_staff_profiles_by_vendor_id(session: AsyncSession, vendor_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(StaffProfile)
        .join(Restaurant, StaffProfile.restaurant_id == Restaurant.id)
        .where(Restaurant.vendor_id == vendor_id)
    )
    return result.scalar_one()


async def get_staff_profile_by_id(
    session: AsyncSession, profile_id: uuid.UUID
) -> StaffProfile | None:
    return await session.get(StaffProfile, profile_id)


async def delete_staff_profile(session: AsyncSession, profile: StaffProfile) -> None:
    user = await session.get(User, profile.user_id)
    if user:
        user.permissions = permissions_without(user.permissions, STAFF_PERMISSIONS)
    await session.delete(profile)
    await session.commit()
