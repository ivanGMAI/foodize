import uuid

from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.auth.service import get_current_user
from features.menu import service as menu_service
from features.menu.schemas import AvailabilityUpdate, MenuItemResponse
from features.staff import service
from features.staff.crud import get_last_request_by_user, get_staff_profile_by_user_id
from features.staff.dependencies import get_valid_staff_request
from features.staff.models import StaffRequest
from features.staff.schemas import (
    StaffMemberResponse,
    StaffProfileResponse,
    StaffRequestCreate,
    StaffRequestResponse,
    StaffRequestStatusUpdate,
)
from features.users.models import User
from features.vendors.dependencies import get_current_vendor
from features.vendors.models import VendorProfile
from shared.dependencies import require_permission
from shared.enums.permissions import Permission
from shared.exceptions import AccessDeniedException, NotFoundException
from shared.response import build_list_response, build_response
from shared.schemas.response import SuccessListResponse, SuccessResponse

router = APIRouter(prefix="/staff", tags=["Staff"])


@router.get("/me", response_model=SuccessResponse[StaffProfileResponse])
async def get_my_staff_profile(
    current_user: User = Depends(require_permission(Permission.STAFF_PROFILE_READ)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[StaffProfileResponse]:
    profile = await get_staff_profile_by_user_id(session, current_user.id)
    if not profile:
        raise NotFoundException(detail="Staff profile not found")
    return build_response(StaffProfileResponse.model_validate(profile))


@router.get("/my-application", response_model=SuccessResponse[StaffRequestResponse] | None)
async def get_my_application(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[StaffRequestResponse] | None:
    req = await get_last_request_by_user(session, current_user.id)
    if not req:
        return None
    return build_response(StaffRequestResponse.model_validate(req))


@router.post("/requests/{restaurant_id}", response_model=SuccessResponse[StaffRequestResponse])
async def create_staff_request(
    restaurant_id: uuid.UUID,
    request_in: StaffRequestCreate,
    current_user: User = Depends(require_permission(Permission.STAFF_REQUESTS_CREATE)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[StaffRequestResponse]:
    result = await service.create_staff_request(
        session=session,
        user_id=current_user.id,
        restaurant_id=restaurant_id,
        request_data=request_in,
    )
    return build_response(result)


@router.patch(
    "/requests/{request_id}/status",
    response_model=SuccessResponse[StaffRequestResponse],
)
async def update_staff_status(
    status_update: StaffRequestStatusUpdate,
    staff_request: StaffRequest = Depends(get_valid_staff_request),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[StaffRequestResponse]:
    result = await service.process_staff_request(
        session=session, request=staff_request, new_status=status_update.status
    )
    return build_response(result)


@router.get("/my-requests", response_model=SuccessListResponse[StaffRequestResponse])
async def get_vendor_requests(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _user: User = Depends(require_permission(Permission.STAFF_REQUESTS_MANAGE)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[StaffRequestResponse]:
    data, total = await service.get_vendor_staff_requests(
        session=session, vendor_id=current_vendor.id, page=page, size=size
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.get("/my-members", response_model=SuccessListResponse[StaffMemberResponse])
async def get_vendor_members(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _user: User = Depends(require_permission(Permission.STAFF_MEMBERS_MANAGE)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[StaffMemberResponse]:
    data, total = await service.get_vendor_staff_members(
        session=session, vendor_id=current_vendor.id, page=page, size=size
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.delete("/members/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_staff_member(
    profile_id: uuid.UUID,
    _user: User = Depends(require_permission(Permission.STAFF_MEMBERS_MANAGE)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> None:
    await service.remove_staff_member(
        session=session, profile_id=profile_id, vendor_id=current_vendor.id
    )


@router.patch(
    "/menu/{restaurant_id}/items/{item_id}/availability",
    response_model=SuccessResponse[MenuItemResponse],
    tags=["Menu"],
)
async def staff_toggle_item_availability(
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    data: AvailabilityUpdate,
    current_user: User = Depends(require_permission(Permission.STAFF_PROFILE_READ)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[MenuItemResponse]:
    staff_profile = await get_staff_profile_by_user_id(session, current_user.id)
    if not staff_profile or staff_profile.restaurant_id != restaurant_id:
        raise AccessDeniedException(detail="Not authorized to manage this restaurant's menu")
    result = await menu_service.toggle_item_availability_for_staff(
        session=session,
        restaurant_id=restaurant_id,
        item_id=item_id,
        is_available=data.is_available,
    )
    return build_response(result)
