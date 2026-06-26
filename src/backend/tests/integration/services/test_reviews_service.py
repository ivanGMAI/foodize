import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.restaurants.exceptions import RestaurantNotFoundException
from features.reviews.exceptions import ReviewLimitExceededException
from features.reviews.schemas import ReviewCreate, ReviewResponse
from features.reviews.service import (
    create_review_for_user,
    get_rating_for_restaurant,
    list_reviews_for_restaurant,
)


def _mock_review(user_id: uuid.UUID, restaurant_id: uuid.UUID) -> MagicMock:
    from datetime import datetime, timezone

    r = MagicMock()
    r.id = uuid.uuid4()
    r.user_id = user_id
    r.restaurant_id = restaurant_id
    r.rating = 4
    r.text = "Good food"
    r.user_name = None
    r.is_verified_purchase = False
    r.created_at = datetime.now(timezone.utc)
    r.user = None
    return r


class TestCreateReviewForUser:
    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        self.user_id = uuid.uuid4()
        self.restaurant_id = uuid.uuid4()
        mock_restaurant = MagicMock()
        mock_restaurant.id = self.restaurant_id
        mock_restaurant.average_rating = 4.0
        mock_restaurant.review_count = 1

        self.mock_get_restaurant = patch(
            "features.reviews.service.get_restaurant_by_id",
            new_callable=AsyncMock,
            return_value=mock_restaurant,
        ).start()
        self.mock_has_order = patch(
            "features.reviews.service._has_completed_order",
            new_callable=AsyncMock,
            return_value=True,
        ).start()
        self.mock_count_user_reviews = patch(
            "features.reviews.crud.count_user_reviews_for_restaurant",
            new_callable=AsyncMock,
            return_value=0,
        ).start()
        self.mock_create = patch(
            "features.reviews.crud.create_review",
            new_callable=AsyncMock,
            return_value=_mock_review(self.user_id, self.restaurant_id),
        ).start()
        self.mock_avg_rating = patch(
            "features.reviews.crud.get_restaurant_avg_rating",
            new_callable=AsyncMock,
            return_value=(4.0, 1),
        ).start()

        yield
        patch.stopall()

    async def test_success(self, mock_db_session):
        data = ReviewCreate(rating=4, text="Good food")
        result = await create_review_for_user(
            mock_db_session, data, self.user_id, self.restaurant_id
        )
        assert isinstance(result, ReviewResponse)
        assert result.rating == 4
        self.mock_create.assert_awaited_once()

    async def test_restaurant_not_found_raises(self, mock_db_session):
        self.mock_get_restaurant.return_value = None
        with pytest.raises(RestaurantNotFoundException):
            await create_review_for_user(
                mock_db_session,
                ReviewCreate(rating=5),
                self.user_id,
                self.restaurant_id,
            )

    async def test_no_completed_order_sets_unverified(self, mock_db_session):
        self.mock_has_order.return_value = False
        result = await create_review_for_user(
            mock_db_session,
            ReviewCreate(rating=3),
            self.user_id,
            self.restaurant_id,
        )
        assert isinstance(result, ReviewResponse)
        self.mock_create.assert_awaited_once()
        _, kwargs = self.mock_create.call_args
        assert kwargs.get("is_verified_purchase") is False

    async def test_completed_order_sets_verified(self, mock_db_session):
        result = await create_review_for_user(
            mock_db_session,
            ReviewCreate(rating=5),
            self.user_id,
            self.restaurant_id,
        )
        assert isinstance(result, ReviewResponse)
        _, kwargs = self.mock_create.call_args
        assert kwargs.get("is_verified_purchase") is True

    async def test_review_limit_raises(self, mock_db_session):
        self.mock_count_user_reviews.return_value = 5
        with pytest.raises(ReviewLimitExceededException):
            await create_review_for_user(
                mock_db_session,
                ReviewCreate(rating=5),
                self.user_id,
                self.restaurant_id,
            )
        self.mock_create.assert_not_awaited()


class TestListReviewsForRestaurant:
    async def test_returns_paginated_list(self, mock_db_session):
        restaurant_id = uuid.uuid4()
        mock_reviews = [_mock_review(uuid.uuid4(), restaurant_id) for _ in range(3)]

        with (
            patch(
                "features.reviews.crud.get_reviews_by_restaurant",
                new_callable=AsyncMock,
                return_value=mock_reviews,
            ),
            patch(
                "features.reviews.crud.count_reviews_by_restaurant",
                new_callable=AsyncMock,
                return_value=3,
            ),
        ):
            data, total = await list_reviews_for_restaurant(mock_db_session, restaurant_id)

        assert len(data) == 3
        assert total == 3
        assert all(isinstance(r, ReviewResponse) for r in data)

    async def test_empty(self, mock_db_session):
        with (
            patch(
                "features.reviews.crud.get_reviews_by_restaurant",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "features.reviews.crud.count_reviews_by_restaurant",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            data, total = await list_reviews_for_restaurant(mock_db_session, uuid.uuid4())

        assert data == []
        assert total == 0


class TestGetRatingForRestaurant:
    async def test_with_reviews(self, mock_db_session):
        restaurant_id = uuid.uuid4()

        mock_restaurant = MagicMock()
        mock_restaurant.average_rating = 4.5
        mock_restaurant.review_count = 10

        with patch(
            "features.reviews.service.get_restaurant_by_id",
            new_callable=AsyncMock,
            return_value=mock_restaurant,
        ):
            result = await get_rating_for_restaurant(mock_db_session, restaurant_id)

        assert result.average_rating == 4.5
        assert result.review_count == 10
        assert result.restaurant_id == restaurant_id

    async def test_no_reviews(self, mock_db_session):
        restaurant_id = uuid.uuid4()

        mock_restaurant = MagicMock()
        mock_restaurant.average_rating = None
        mock_restaurant.review_count = 0

        with patch(
            "features.reviews.service.get_restaurant_by_id",
            new_callable=AsyncMock,
            return_value=mock_restaurant,
        ):
            result = await get_rating_for_restaurant(mock_db_session, restaurant_id)

        assert result.average_rating is None
        assert result.review_count == 0
