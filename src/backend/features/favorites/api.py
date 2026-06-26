import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.favorites import service
from features.favorites.schemas import FavoriteResponse
from features.users.models import User
from shared.dependencies import require_permission
from shared.enums.permissions import Permission
from shared.response import build_list_response, build_response
from shared.schemas.response import SuccessListResponse, SuccessResponse

router = APIRouter(prefix="/favorites", tags=["Favorites"])


@router.get("", response_model=SuccessListResponse[FavoriteResponse])
async def get_my_favorites(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission(Permission.FAVORITES_MANAGE)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[FavoriteResponse]:
    data, total = await service.get_my_favorites(
        session=session, user_id=current_user.id, page=page, size=size
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.post(
    "/{restaurant_id}",
    response_model=SuccessResponse[FavoriteResponse],
    status_code=status.HTTP_201_CREATED,
)
async def add_favorite(
    restaurant_id: uuid.UUID,
    current_user: User = Depends(require_permission(Permission.FAVORITES_MANAGE)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[FavoriteResponse]:
    result = await service.add_favorite(
        session=session, user_id=current_user.id, restaurant_id=restaurant_id
    )
    return build_response(result)


@router.delete("/{restaurant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    restaurant_id: uuid.UUID,
    current_user: User = Depends(require_permission(Permission.FAVORITES_MANAGE)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> None:
    await service.remove_favorite(
        session=session, user_id=current_user.id, restaurant_id=restaurant_id
    )
