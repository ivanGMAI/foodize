from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.promos import crud as promos_crud
from features.promos import service
from features.promos.schemas import (
    PromoCreate,
    PromoResponse,
    PromoValidateRequest,
    PromoValidateResponse,
)
from features.users.models import User
from features.vendors.dependencies import get_current_vendor
from features.vendors.models import VendorProfile
from shared.dependencies import require_permission
from shared.enums.permissions import Permission
from shared.response import build_list_response, build_response
from shared.schemas.response import SuccessListResponse, SuccessResponse

router = APIRouter(prefix="/promos", tags=["Promos"])


@router.post("", response_model=SuccessResponse[PromoResponse], status_code=201)
async def create_promo(
    data: PromoCreate,
    _user: User = Depends(require_permission(Permission.PROMOS_MANAGE)),
    vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[PromoResponse]:
    restaurant_ids = await promos_crud.get_restaurant_ids_by_vendor(session, vendor.id)
    result = await service.create_promo(session, data, restaurant_ids, actor_id=_user.id)
    return build_response(result)


@router.get("", response_model=SuccessListResponse[PromoResponse])
async def list_promos(
    request: Request,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _user: User = Depends(require_permission(Permission.PROMOS_MANAGE)),
    vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[PromoResponse]:
    restaurant_ids = await promos_crud.get_restaurant_ids_by_vendor(session, vendor.id)
    data, total = await service.get_vendor_promos(session, restaurant_ids, page=page, size=size)
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.delete("/{code}", status_code=204)
async def deactivate_promo(
    code: str,
    _user: User = Depends(require_permission(Permission.PROMOS_MANAGE)),
    vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> None:
    restaurant_ids = await promos_crud.get_restaurant_ids_by_vendor(session, vendor.id)
    await service.deactivate_promo(session, code, restaurant_ids, actor_id=_user.id)


@router.post("/validate", response_model=SuccessResponse[PromoValidateResponse])
async def validate_promo(
    data: PromoValidateRequest,
    _current_user: User = Depends(require_permission(Permission.PROMOS_VALIDATE)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[PromoValidateResponse]:
    result = await service.validate_promo(session, data.code, data.restaurant_id)
    return build_response(result)
