import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.auth.schemas import UserLogin
from features.users.exceptions import UserAlreadyExistsException
from features.users.models import User
from shared.exceptions.existence import InvalidCredentialsException, NotFoundException
from utils.JWT import validate_password


async def get_user_by_phone_or_401(
    session: AsyncSession,
    user_data: UserLogin,
) -> User:
    user = await get_user_by_phone(session, user_data.phone_number)
    if (
        not user
        or not user.hashed_password
        or not validate_password(user_data.password, user.hashed_password)
    ):
        raise InvalidCredentialsException()
    return user


async def get_user_by_phone(session: AsyncSession, phone_number: str) -> User | None:
    stmt = select(User).where(User.phone_number == phone_number)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    stmt = select(User).where(User.id == user_id)
    result = await session.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_id_or_404(
    session: AsyncSession,
    user_id: uuid.UUID,
) -> User:
    user = await get_user_by_id(session, user_id)
    if not user:
        raise NotFoundException()
    return user


async def ensure_user_not_exists_by_phone(session: AsyncSession, phone_number: str) -> None:
    user = await get_user_by_phone(session, phone_number)
    if user:
        raise UserAlreadyExistsException()
