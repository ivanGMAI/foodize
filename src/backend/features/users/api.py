import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.auth.service import get_current_user
from features.users import crud
from features.users.dependencies import get_user_by_id_or_404
from features.users.models import User
from features.users.schemas import ChangePasswordRequest, UserRead, UserUpdate
from shared.enums.permissions import Permission
from shared.exceptions.existence import AuthException
from shared.exceptions.rules import AccessDeniedException
from shared.permissions import has_permission
from shared.response import build_response
from shared.schemas.response import SuccessResponse
from utils.JWT import validate_password

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=SuccessResponse[UserRead])
async def read_my_profile(
    current_user: User = Depends(get_current_user),
) -> SuccessResponse[UserRead]:
    return build_response(UserRead.model_validate(current_user))


@router.patch("/me", response_model=SuccessResponse[UserRead])
async def update_my_profile(
    data: UserUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[UserRead]:
    updated = await crud.update_user(session, current_user, data)
    return build_response(UserRead.model_validate(updated))


@router.post("/me/change-password", status_code=status.HTTP_204_NO_CONTENT)
async def change_my_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> None:
    if not current_user.hashed_password or not validate_password(
        data.old_password, current_user.hashed_password
    ):
        raise AuthException(detail="Wrong password")
    await crud.update_user_password(session, current_user, data.new_password)


@router.get("/{user_id}", response_model=SuccessResponse[UserRead])
async def read_user(
    user_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[UserRead]:
    if current_user.id != user_id and not has_permission(
        current_user.permissions, Permission.USERS_READ
    ):
        raise AccessDeniedException()
    user = await get_user_by_id_or_404(session=session, user_id=user_id)
    return build_response(UserRead.model_validate(user))
