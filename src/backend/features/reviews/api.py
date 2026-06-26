import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.reviews import service
from features.reviews.schemas import RatingResponse, ReviewCreate, ReviewResponse
from features.users.models import User
from shared.dependencies import require_permission
from shared.enums.permissions import Permission
from shared.response import build_list_response, build_response
from shared.schemas.response import SuccessListResponse, SuccessResponse

router = APIRouter(prefix="/restaurants", tags=["Reviews"])


@router.post(
    "/{restaurant_id}/reviews",
    response_model=SuccessResponse[ReviewResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_review(
    restaurant_id: uuid.UUID,
    review_in: ReviewCreate,
    current_user: User = Depends(require_permission(Permission.REVIEWS_CREATE)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[ReviewResponse]:
    result = await service.create_review_for_user(
        session=session,
        review_data=review_in,
        user_id=current_user.id,
        restaurant_id=restaurant_id,
    )
    return build_response(result)


@router.delete(
    "/{restaurant_id}/reviews/{review_id}",
    response_model=SuccessResponse[ReviewResponse],
)
async def delete_my_review(
    restaurant_id: uuid.UUID,
    review_id: uuid.UUID,
    current_user: User = Depends(require_permission(Permission.REVIEWS_CREATE)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[ReviewResponse]:
    result = await service.delete_review_for_user(
        session=session,
        review_id=review_id,
        user_id=current_user.id,
        restaurant_id=restaurant_id,
    )
    return build_response(result)


@router.put(
    "/{restaurant_id}/reviews/my",
    response_model=SuccessResponse[ReviewResponse],
)
async def update_my_review(
    restaurant_id: uuid.UUID,
    review_in: ReviewCreate,
    current_user: User = Depends(require_permission(Permission.REVIEWS_CREATE)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[ReviewResponse]:
    result = await service.update_review_for_user(
        session=session,
        review_data=review_in,
        user_id=current_user.id,
        restaurant_id=restaurant_id,
    )
    return build_response(result)


@router.get("/{restaurant_id}/reviews", response_model=SuccessListResponse[ReviewResponse])
async def read_reviews(
    request: Request,
    restaurant_id: uuid.UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[ReviewResponse]:
    data, total = await service.list_reviews_for_restaurant(
        session=session, restaurant_id=restaurant_id, page=page, size=size
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.get("/{restaurant_id}/rating", response_model=SuccessResponse[RatingResponse])
async def read_rating(
    restaurant_id: uuid.UUID,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[RatingResponse]:
    result = await service.get_rating_for_restaurant(session=session, restaurant_id=restaurant_id)
    return build_response(result)
