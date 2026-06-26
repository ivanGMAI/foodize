import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from features.reviews.models import Review
from features.reviews.schemas import ReviewCreate


async def create_review(
    session: AsyncSession,
    review_data: ReviewCreate,
    user_id: uuid.UUID,
    restaurant_id: uuid.UUID,
    is_verified_purchase: bool = False,
) -> Review:
    review = Review(
        user_id=user_id,
        restaurant_id=restaurant_id,
        is_verified_purchase=is_verified_purchase,
        **review_data.model_dump(),
    )
    session.add(review)
    await session.commit()
    await session.refresh(review)
    return review


async def get_reviews_by_restaurant(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    offset: int = 0,
    limit: int = 20,
) -> list[Review]:
    result = await session.execute(
        select(Review)
        .options(selectinload(Review.user))
        .where(
            Review.restaurant_id == restaurant_id,
            Review.deleted_at.is_(None),
        )
        .order_by(Review.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def count_reviews_by_restaurant(session: AsyncSession, restaurant_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(Review)
        .where(
            Review.restaurant_id == restaurant_id,
            Review.deleted_at.is_(None),
        )
    )
    return result.scalar_one()


async def count_user_reviews_for_restaurant(
    session: AsyncSession, user_id: uuid.UUID, restaurant_id: uuid.UUID
) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(Review)
        .where(
            Review.user_id == user_id,
            Review.restaurant_id == restaurant_id,
            Review.deleted_at.is_(None),
        )
    )
    return result.scalar_one()


async def get_review_by_id_for_user(
    session: AsyncSession,
    review_id: uuid.UUID,
    user_id: uuid.UUID,
    restaurant_id: uuid.UUID,
) -> Review | None:
    result = await session.execute(
        select(Review).where(
            Review.id == review_id,
            Review.user_id == user_id,
            Review.restaurant_id == restaurant_id,
            Review.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def get_user_review_for_restaurant(
    session: AsyncSession,
    user_id: uuid.UUID,
    restaurant_id: uuid.UUID,
    include_deleted: bool = False,
) -> Review | None:
    filters = [
        Review.user_id == user_id,
        Review.restaurant_id == restaurant_id,
    ]
    if not include_deleted:
        filters.append(Review.deleted_at.is_(None))

    result = await session.execute(select(Review).where(*filters))
    return result.scalar_one_or_none()


async def update_review(
    session: AsyncSession,
    review: Review,
    review_data: ReviewCreate,
    is_verified_purchase: bool | None = None,
) -> Review:
    update_data = review_data.model_dump()
    for field, value in update_data.items():
        setattr(review, field, value)
    if is_verified_purchase is not None:
        review.is_verified_purchase = is_verified_purchase
    review.deleted_at = None
    session.add(review)
    await session.flush()
    await session.refresh(review)
    return review


async def get_restaurant_avg_rating(
    session: AsyncSession, restaurant_id: uuid.UUID
) -> tuple[float | None, int]:
    result = await session.execute(
        select(func.avg(Review.rating), func.count(Review.id)).where(
            Review.restaurant_id == restaurant_id,
            Review.deleted_at.is_(None),
        )
    )
    avg, count = result.one()
    return (round(float(avg), 2) if avg is not None else None, count)


async def delete_review(session: AsyncSession, review: Review) -> None:
    review.deleted_at = datetime.now(UTC)
    await session.commit()
