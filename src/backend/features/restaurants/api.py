import uuid

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.restaurants import service
from features.restaurants.models import Restaurant
from features.restaurants.schemas import (
    RestaurantCreate,
    RestaurantResponse,
    RestaurantUpdate,
)
from features.restaurants.working_hours_crud import get_working_hours, set_working_hours
from features.restaurants.working_hours_schemas import (
    WorkingHoursBulkSet,
    WorkingHoursRead,
)
from features.users.models import User
from features.vendors.dependencies import get_current_vendor
from features.vendors.models import VendorProfile
from shared.dependencies import require_permission
from shared.enums.permissions import Permission
from shared.enums.restaurant_sort import RestaurantSort
from shared.enums.sort_direction import SortDirection
from shared.exceptions.existence import NotFoundException
from shared.exceptions.rules import AccessDeniedException
from shared.response import build_list_response, build_response
from shared.schemas.response import SuccessListResponse, SuccessResponse

router = APIRouter(prefix="/restaurants", tags=["Restaurants"])


@router.get("/public/{restaurant_id}", response_model=SuccessResponse[RestaurantResponse])
async def read_public_restaurant(
    restaurant_id: str,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[RestaurantResponse]:
    result = await service.get_restaurant_public(session=session, identifier=restaurant_id)
    return build_response(result)


@router.get("/public", response_model=SuccessListResponse[RestaurantResponse])
async def read_public_restaurants(
    request: Request,
    name: str | None = Query(None, max_length=128),
    is_hiring: bool | None = Query(None),
    is_open: bool | None = Query(None),
    sort: RestaurantSort = Query(RestaurantSort.DEFAULT),
    direction: SortDirection = Query(SortDirection.DESC),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[RestaurantResponse]:
    data, total = await service.get_all_restaurants_public(
        session=session,
        name=name,
        is_hiring=is_hiring,
        is_open=is_open,
        sort=sort,
        direction=direction,
        page=page,
        size=size,
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.post("/", response_model=SuccessResponse[RestaurantResponse])
async def create_restaurant(
    restaurant_in: RestaurantCreate,
    _user: User = Depends(require_permission(Permission.RESTAURANTS_CREATE)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[RestaurantResponse]:
    result = await service.create_restaurant_for_vendor(
        session=session, restaurant_data=restaurant_in, vendor_id=current_vendor.id
    )
    return build_response(result)


@router.patch("/{restaurant_id}", response_model=SuccessResponse[RestaurantResponse])
async def update_restaurant(
    restaurant_id: uuid.UUID,
    update_in: RestaurantUpdate,
    _user: User = Depends(require_permission(Permission.RESTAURANTS_UPDATE)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[RestaurantResponse]:
    result = await service.update_restaurant_for_vendor(
        session=session,
        restaurant_id=restaurant_id,
        update_data=update_in,
        vendor_id=current_vendor.id,
    )
    return build_response(result)


@router.get("/", response_model=SuccessListResponse[RestaurantResponse])
async def read_my_restaurants(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[RestaurantResponse]:
    data, total = await service.get_my_restaurants(
        session=session, vendor_id=current_vendor.id, page=page, size=size
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.get(
    "/{restaurant_id}/working-hours",
    response_model=SuccessResponse[list[WorkingHoursRead]],
)
async def read_working_hours(
    restaurant_id: str,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[list[WorkingHoursRead]]:
    try:
        parsed_uuid = uuid.UUID(restaurant_id)
        where_clause = Restaurant.id == parsed_uuid
    except ValueError:
        where_clause = Restaurant.display_id == restaurant_id

    result = await session.execute(select(Restaurant.id).where(where_clause))
    real_id = result.scalar_one_or_none()
    if not real_id:
        raise NotFoundException(detail="Restaurant not found")

    rows = await get_working_hours(session, real_id)
    return build_response([WorkingHoursRead.model_validate(r) for r in rows])


@router.put(
    "/{restaurant_id}/working-hours",
    response_model=SuccessResponse[list[WorkingHoursRead]],
)
async def set_working_hours_endpoint(
    restaurant_id: uuid.UUID,
    body: WorkingHoursBulkSet,
    _user: User = Depends(require_permission(Permission.RESTAURANTS_UPDATE)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[list[WorkingHoursRead]]:
    restaurant: Restaurant | None = await session.get(Restaurant, restaurant_id)
    if not restaurant:
        raise NotFoundException()
    if restaurant.vendor_id != current_vendor.id:
        raise AccessDeniedException()
    rows = await set_working_hours(session, restaurant_id, body.hours)
    return build_response([WorkingHoursRead.model_validate(r) for r in rows])
