import uuid
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.admin.schemas import AdvancedAnalytics, FinanceAnalytics
from features.users.models import User
from features.vendors import export as vendor_export
from features.vendors import service
from features.vendors.dependencies import get_current_vendor
from features.vendors.models import VendorProfile
from features.vendors.schemas import (
    VendorCreate,
    VendorResponse,
)
from shared.dependencies import require_permission
from shared.enums.order_status import OrderStatus
from shared.enums.permissions import Permission
from shared.response import build_response
from shared.schemas.response import SuccessResponse

router = APIRouter(prefix="/vendors", tags=["Vendors"])


@router.post(
    "/",
    response_model=SuccessResponse[VendorResponse],
    status_code=status.HTTP_201_CREATED,
)
async def create_vendor(
    vendor_in: VendorCreate,
    user: User = Depends(require_permission(Permission.VENDORS_CREATE)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[VendorResponse]:
    result = await service.register_vendor(user=user, session=session, vendor_in=vendor_in)
    return build_response(result)


@router.get("/", response_model=SuccessResponse[VendorResponse])
async def read_my_vendor_profile(
    current_vendor: VendorProfile = Depends(get_current_vendor),
) -> SuccessResponse[VendorResponse]:
    return build_response(VendorResponse.model_validate(current_vendor))


@router.get("/finance", response_model=SuccessResponse[FinanceAnalytics])
async def read_vendor_finance(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    restaurant_id: uuid.UUID | None = Query(None),
    _user: User = Depends(require_permission(Permission.VENDORS_ANALYTICS_READ)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[FinanceAnalytics]:
    result = await service.get_vendor_finance(
        session=session,
        vendor=current_vendor,
        date_from=date_from,
        date_to=date_to,
        restaurant_id=restaurant_id,
    )
    return build_response(result)


@router.get("/analytics", response_model=SuccessResponse[AdvancedAnalytics])
async def read_vendor_analytics(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    restaurant_id: uuid.UUID | None = Query(None),
    _user: User = Depends(require_permission(Permission.VENDORS_ANALYTICS_READ)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdvancedAnalytics]:
    result = await service.get_vendor_analytics(
        session=session,
        vendor=current_vendor,
        date_from=date_from,
        date_to=date_to,
        restaurant_id=restaurant_id,
    )
    return build_response(result)


@router.get("/export/orders.csv")
async def export_orders_csv(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    status: str | None = Query(None),
    restaurant_id: uuid.UUID | None = Query(None),
    _user: User = Depends(require_permission(Permission.VENDORS_ANALYTICS_READ)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    order_status = None
    if status:
        try:
            order_status = OrderStatus(status)
        except ValueError:
            pass
    data = await vendor_export.export_orders_csv(
        session,
        vendor=current_vendor,
        date_from=date_from,
        date_to=date_to,
        status=order_status,
        restaurant_id=restaurant_id,
    )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders.csv"},
    )


@router.get("/export/menu.csv")
async def export_menu_csv(
    restaurant_id: uuid.UUID | None = Query(None),
    _user: User = Depends(require_permission(Permission.MENU_MANAGE)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    data = await vendor_export.export_menu_csv(
        session, vendor=current_vendor, restaurant_id=restaurant_id
    )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=menu.csv"},
    )


@router.get("/export/promos.csv")
async def export_promos_csv(
    restaurant_id: uuid.UUID | None = Query(None),
    _user: User = Depends(require_permission(Permission.PROMOS_MANAGE)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    data = await vendor_export.export_promos_csv(
        session, vendor=current_vendor, restaurant_id=restaurant_id
    )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=promos.csv"},
    )


@router.get("/export/finance.pdf")
async def export_finance_pdf(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    restaurant_id: uuid.UUID | None = Query(None),
    _user: User = Depends(require_permission(Permission.VENDORS_ANALYTICS_READ)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    data = await vendor_export.export_finance_pdf(
        session,
        vendor=current_vendor,
        date_from=date_from,
        date_to=date_to,
        restaurant_id=restaurant_id,
    )
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=finance.pdf"},
    )


@router.get("/export/analytics.pdf")
async def export_analytics_pdf(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    restaurant_id: uuid.UUID | None = Query(None),
    _user: User = Depends(require_permission(Permission.VENDORS_ANALYTICS_READ)),
    current_vendor: VendorProfile = Depends(get_current_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    data = await vendor_export.export_analytics_pdf(
        session,
        vendor=current_vendor,
        date_from=date_from,
        date_to=date_to,
        restaurant_id=restaurant_id,
    )
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=analytics.pdf"},
    )
