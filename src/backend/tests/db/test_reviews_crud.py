import pytest

from features.restaurants.crud import create_restaurant
from features.restaurants.schemas import RestaurantCreate
from features.reviews.crud import (
    count_reviews_by_restaurant,
    create_review,
    get_restaurant_avg_rating,
    get_reviews_by_restaurant,
    get_user_review_for_restaurant,
)
from features.reviews.schemas import ReviewCreate
from features.users.crud import create_user
from features.users.schemas import UserCreate
from features.vendors.crud import create_vendor_profile
from features.vendors.schemas import VendorCreate
from shared.enums.roles import UserRole


@pytest.fixture
async def seeded(db_session):
    vendor_user = await create_user(
        db_session,
        UserCreate(
            name="Vendor",
            phone_number="79008001001",
            password="strongpassword",
            user_role=UserRole.VENDOR,
        ),
    )
    vendor_profile = await create_vendor_profile(db_session, vendor_user, VendorCreate())
    restaurant = await create_restaurant(
        db_session,
        RestaurantCreate(name="Review Rest", address="R St"),
        vendor_profile.id,
    )

    user1 = await create_user(
        db_session,
        UserCreate(
            name="User1",
            phone_number="79008001002",
            password="strongpassword",
            user_role=UserRole.CUSTOMER,
        ),
    )
    user2 = await create_user(
        db_session,
        UserCreate(
            name="User2",
            phone_number="79008001003",
            password="strongpassword",
            user_role=UserRole.CUSTOMER,
        ),
    )
    return {"restaurant": restaurant, "user1": user1, "user2": user2}


@pytest.mark.asyncio
async def test_create_and_get_review(db_session, seeded):
    restaurant = seeded["restaurant"]
    user = seeded["user1"]

    review = await create_review(
        db_session, ReviewCreate(rating=5, text="Amazing!"), user.id, restaurant.id
    )

    assert review.id is not None
    assert review.rating == 5
    assert review.text == "Amazing!"
    assert review.user_id == user.id
    assert review.restaurant_id == restaurant.id


@pytest.mark.asyncio
async def test_get_reviews_by_restaurant(db_session, seeded):
    restaurant = seeded["restaurant"]

    await create_review(db_session, ReviewCreate(rating=4), seeded["user1"].id, restaurant.id)
    await create_review(db_session, ReviewCreate(rating=2), seeded["user2"].id, restaurant.id)

    reviews = await get_reviews_by_restaurant(db_session, restaurant.id)
    assert len(reviews) == 2


@pytest.mark.asyncio
async def test_count_reviews_by_restaurant(db_session, seeded):
    restaurant = seeded["restaurant"]

    assert await count_reviews_by_restaurant(db_session, restaurant.id) == 0

    await create_review(db_session, ReviewCreate(rating=3), seeded["user1"].id, restaurant.id)
    assert await count_reviews_by_restaurant(db_session, restaurant.id) == 1


@pytest.mark.asyncio
async def test_get_user_review_for_restaurant(db_session, seeded):
    restaurant = seeded["restaurant"]
    user = seeded["user1"]

    assert await get_user_review_for_restaurant(db_session, user.id, restaurant.id) is None

    await create_review(db_session, ReviewCreate(rating=5), user.id, restaurant.id)

    found = await get_user_review_for_restaurant(db_session, user.id, restaurant.id)
    assert found is not None
    assert found.user_id == user.id


@pytest.mark.asyncio
async def test_get_restaurant_avg_rating(db_session, seeded):
    restaurant = seeded["restaurant"]

    avg, count = await get_restaurant_avg_rating(db_session, restaurant.id)
    assert avg is None
    assert count == 0

    await create_review(db_session, ReviewCreate(rating=4), seeded["user1"].id, restaurant.id)
    await create_review(db_session, ReviewCreate(rating=2), seeded["user2"].id, restaurant.id)

    avg, count = await get_restaurant_avg_rating(db_session, restaurant.id)
    assert count == 2
    assert avg == 3.0
