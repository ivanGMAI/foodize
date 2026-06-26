import uuid

import pytest

from features.restaurants.crud import create_restaurant
from features.restaurants.schemas import RestaurantCreate
from features.staff.crud import (
    create_staff_profile,
    create_staff_request,
    get_last_request,
    get_request_by_id,
    get_requests_by_vendor_id,
    get_staff_profile_by_user_id,
    update_request_status,
)
from features.staff.dependencies import get_restaurant_or_404
from features.staff.schemas import StaffRequestCreate
from features.users.crud import create_user
from features.users.schemas import UserCreate
from features.vendors.crud import create_vendor_profile
from features.vendors.schemas import VendorCreate
from shared.enums.roles import UserRole
from shared.enums.staff_request_status import StaffRequestStatus
from shared.exceptions import NotFoundException


@pytest.fixture
async def vendor_and_restaurant(db_session):
    vendor_data = UserCreate(
        name="Vendor",
        phone_number="79003333333",
        password="strongpassword",
        user_role=UserRole.VENDOR,
    )
    vendor_user = await create_user(db_session, vendor_data)
    vendor_profile = await create_vendor_profile(db_session, vendor_user, VendorCreate())

    rest_data = RestaurantCreate(name="Rest", address="Addr")
    restaurant = await create_restaurant(db_session, rest_data, vendor_profile.id)
    return vendor_profile, restaurant


@pytest.fixture
async def staff_candidate(db_session):
    user_data = UserCreate(
        name="Candidate",
        phone_number="79004444444",
        password="strongpassword",
        user_role=UserRole.CUSTOMER,
    )
    return await create_user(db_session, user_data)


@pytest.mark.asyncio
async def test_staff_crud_lifecycle(db_session, vendor_and_restaurant, staff_candidate):
    vendor, restaurant = vendor_and_restaurant
    candidate = staff_candidate

    data = StaffRequestCreate(message="Hire me please")
    request = await create_staff_request(db_session, candidate.id, restaurant.id, data)
    assert request.id is not None
    assert request.message == "Hire me please"
    assert request.status == StaffRequestStatus.PENDING

    last_req = await get_last_request(db_session, candidate.id, restaurant.id)
    assert last_req is not None
    assert last_req.id == request.id

    req_by_id = await get_request_by_id(db_session, request.id)
    assert req_by_id is not None
    assert req_by_id.id == request.id

    reqs_by_vendor = await get_requests_by_vendor_id(db_session, vendor.id)
    assert len(reqs_by_vendor) == 1
    assert reqs_by_vendor[0].id == request.id

    await create_staff_profile(db_session, candidate.id, restaurant.id)
    updated_req = await update_request_status(db_session, request, StaffRequestStatus.ACCEPTED)
    assert updated_req.status == StaffRequestStatus.ACCEPTED

    profile = await get_staff_profile_by_user_id(db_session, candidate.id)
    assert profile is not None
    assert profile.restaurant_id == restaurant.id
    assert profile.user_id == candidate.id


@pytest.mark.asyncio
async def test_update_request_status_no_profile(db_session, vendor_and_restaurant, staff_candidate):
    vendor, restaurant = vendor_and_restaurant
    candidate = staff_candidate

    data = StaffRequestCreate(message="Wanna work")
    request = await create_staff_request(db_session, candidate.id, restaurant.id, data)

    updated_req = await update_request_status(db_session, request, StaffRequestStatus.REJECTED)
    assert updated_req.status == StaffRequestStatus.REJECTED

    profile = await get_staff_profile_by_user_id(db_session, candidate.id)
    assert profile is None


@pytest.mark.asyncio
async def test_get_restaurant_or_404_returns_instance(db_session, vendor_and_restaurant):
    _, restaurant = vendor_and_restaurant

    fetched_restaurant = await get_restaurant_or_404(
        restaurant_id=restaurant.id, session=db_session
    )
    assert fetched_restaurant is not None
    assert fetched_restaurant.id == restaurant.id


@pytest.mark.asyncio
async def test_get_restaurant_or_404_raises_not_found(db_session):
    with pytest.raises(NotFoundException):
        await get_restaurant_or_404(restaurant_id=uuid.uuid4(), session=db_session)
