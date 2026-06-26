from sqlalchemy.ext.asyncio import AsyncSession

from features.users.models import User
from features.users.schemas import UserCreate, UserUpdate
from shared.permissions import CUSTOMER_PERMISSIONS, serialize_permissions
from utils.JWT import hash_password


async def create_user(
    session: AsyncSession,
    user_in: UserCreate,
) -> User:
    user_data = user_in.model_dump(exclude={"password"})
    db_user = User(
        **user_data,
        permissions=serialize_permissions(CUSTOMER_PERMISSIONS),
        hashed_password=hash_password(user_in.password),
    )
    session.add(db_user)
    await session.commit()
    return db_user


async def update_user(session: AsyncSession, user: User, data: UserUpdate) -> User:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(user, key, value)
    await session.commit()
    await session.refresh(user)
    return user


async def update_user_password(session: AsyncSession, user: User, new_password: str) -> None:
    user.hashed_password = hash_password(new_password)
    await session.commit()
