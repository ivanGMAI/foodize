import uuid

from sqlalchemy import exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from features.orders.models.order import Order
from features.restaurants.crud import get_restaurant_by_id
from features.restaurants.exceptions import RestaurantNotFoundException
from features.reviews import crud
from features.reviews.exceptions import ReviewLimitExceededException
from features.reviews.models import Review
from features.reviews.schemas import RatingResponse, ReviewCreate, ReviewResponse
from shared.enums.order_status import OrderStatus
from shared.exceptions import NotFoundException

MAX_REVIEWS_PER_USER_RESTAURANT = 1


def _review_to_response(review: Review) -> ReviewResponse:
    data = ReviewResponse.model_validate(review)
    user = getattr(review, "user", None)
    data.user_name = getattr(user, "name", None)
    return data


async def _has_completed_order(
    session: AsyncSession, user_id: uuid.UUID, restaurant_id: uuid.UUID
) -> bool:
    result = await session.execute(
        select(
            exists().where(
                Order.user_id == user_id,
                Order.restaurant_id == restaurant_id,
                Order.status == OrderStatus.COMPLETED.value,
            )
        )
    )
    return bool(result.scalar_one())


async def create_review_for_user(
    session: AsyncSession,
    review_data: ReviewCreate,
    user_id: uuid.UUID,
    restaurant_id: uuid.UUID,
) -> ReviewResponse:
    restaurant = await get_restaurant_by_id(session, restaurant_id)
    if not restaurant:
        raise RestaurantNotFoundException()

    is_verified = await _has_completed_order(session, user_id, restaurant_id)

    user_reviews_count = await crud.count_user_reviews_for_restaurant(
        session, user_id, restaurant_id
    )
    if user_reviews_count >= MAX_REVIEWS_PER_USER_RESTAURANT:
        raise ReviewLimitExceededException()

    review = await crud.create_review(
        session,
        review_data,
        user_id,
        restaurant_id,
        is_verified_purchase=is_verified,
    )

    avg, count = await crud.get_restaurant_avg_rating(session, restaurant_id)
    restaurant.average_rating = avg or 0.0
    restaurant.review_count = count
    session.add(restaurant)
    await session.commit()

    return _review_to_response(review)


async def delete_review_for_user(
    session: AsyncSession,
    review_id: uuid.UUID,
    user_id: uuid.UUID,
    restaurant_id: uuid.UUID,
) -> ReviewResponse:
    restaurant = await get_restaurant_by_id(session, restaurant_id)
    if not restaurant:
        raise RestaurantNotFoundException()

    review = await crud.get_review_by_id_for_user(session, review_id, user_id, restaurant_id)
    if not review:
        raise NotFoundException(detail="Review not found")

    response = _review_to_response(review)
    await crud.delete_review(session, review)

    avg, count = await crud.get_restaurant_avg_rating(session, restaurant_id)
    restaurant.average_rating = avg or 0.0
    restaurant.review_count = count
    session.add(restaurant)
    await session.commit()

    return response


async def update_review_for_user(
    session: AsyncSession,
    review_data: ReviewCreate,
    user_id: uuid.UUID,
    restaurant_id: uuid.UUID,
) -> ReviewResponse:
    restaurant = await get_restaurant_by_id(session, restaurant_id)
    if not restaurant:
        raise RestaurantNotFoundException()

    review = await crud.get_user_review_for_restaurant(session, user_id, restaurant_id)
    if not review:
        raise NotFoundException(detail="Review not found")

    updated = await crud.update_review(session, review, review_data)

    avg, count = await crud.get_restaurant_avg_rating(session, restaurant_id)
    restaurant.average_rating = avg or 0.0
    restaurant.review_count = count
    session.add(restaurant)
    await session.commit()

    return _review_to_response(updated)


async def list_reviews_for_restaurant(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    page: int = 1,
    size: int = 20,
) -> tuple[list[ReviewResponse], int]:
    offset = (page - 1) * size
    data = await crud.get_reviews_by_restaurant(session, restaurant_id, offset=offset, limit=size)
    total = await crud.count_reviews_by_restaurant(session, restaurant_id)
    return [_review_to_response(r) for r in data], total


async def get_rating_for_restaurant(
    session: AsyncSession, restaurant_id: uuid.UUID
) -> RatingResponse:
    restaurant = await get_restaurant_by_id(session, restaurant_id)
    if not restaurant:
        raise RestaurantNotFoundException()
    return RatingResponse(
        restaurant_id=restaurant_id,
        average_rating=restaurant.average_rating,
        review_count=restaurant.review_count,
    )
