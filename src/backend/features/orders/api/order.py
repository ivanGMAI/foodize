import uuid
from datetime import date

from fastapi import APIRouter, Depends, Header, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.auth.service import get_current_user
from features.orders.dependencies import (
    get_order_for_staff_or_vendor,
    get_restaurant_staff_or_vendor,
    verify_restaurant_access,
)
from features.orders.models import Order
from features.orders.schemas.order import (
    OrderCancelRequest,
    OrderCreate,
    OrderLoadEstimate,
    OrderResponse,
    OrderStatusUpdate,
)
from features.orders.schemas.order_event import OrderEventResponse
from features.orders.services import order as service
from features.restaurants.models import Restaurant
from features.users.models import User
from middlewares.limiter import limiter
from shared.dependencies import require_permission
from shared.enums.order_status import OrderStatus
from shared.enums.permissions import Permission
from shared.exceptions import AccessDeniedException, NotFoundException
from shared.permissions import has_permission
from shared.response import build_list_response, build_response
from shared.schemas.response import SuccessListResponse, SuccessResponse

router = APIRouter(prefix="/orders", tags=["Orders"])


async def verify_order_read_access(session: AsyncSession, order: Order, current_user: User) -> None:
    if has_permission(current_user.permissions, Permission.ORDERS_MODERATE):
        return

    if (
        has_permission(current_user.permissions, Permission.ORDERS_READ_OWN)
        and order.user_id == current_user.id
    ):
        return

    if has_permission(current_user.permissions, Permission.ORDERS_READ_RESTAURANT):
        await verify_restaurant_access(session, order.restaurant_id, current_user)
        return

    raise AccessDeniedException()


@router.post(
    "/",
    response_model=SuccessResponse[OrderResponse],
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
async def create_order(
    request: Request,
    order_in: OrderCreate,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    current_user: User = Depends(require_permission(Permission.ORDERS_CREATE)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[OrderResponse]:
    result = await service.place_order(
        session=session,
        order_data=order_in,
        user_id=current_user.id,
        idempotency_key=idempotency_key,
    )
    return build_response(result)


@router.get(
    "/estimate/{restaurant_id}",
    response_model=SuccessResponse[OrderLoadEstimate],
)
async def read_order_load_estimate(
    restaurant_id: uuid.UUID,
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[OrderLoadEstimate]:
    result = await service.estimate_restaurant_load(
        session=session,
        restaurant_id=restaurant_id,
    )
    return build_response(result)


@router.get("/me", response_model=SuccessListResponse[OrderResponse])
async def read_my_orders(
    request: Request,
    status: OrderStatus | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(require_permission(Permission.ORDERS_READ_OWN)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[OrderResponse]:
    data, total = await service.get_user_orders(
        session=session, user_id=current_user.id, status=status, page=page, size=size
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.get("/restaurant/{restaurant_id}", response_model=SuccessListResponse[OrderResponse])
async def read_restaurant_orders(
    request: Request,
    status: OrderStatus | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    restaurant: Restaurant = Depends(get_restaurant_staff_or_vendor),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[OrderResponse]:
    data, total = await service.get_restaurant_orders(
        session=session,
        restaurant_id=restaurant.id,
        status=status,
        date_from=date_from,
        date_to=date_to,
        page=page,
        size=size,
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.patch("/{order_id}/status", response_model=SuccessResponse[OrderResponse])
async def update_order_status(
    status_in: OrderStatusUpdate,
    order: Order = Depends(get_order_for_staff_or_vendor),
    current_user: User = Depends(require_permission(Permission.ORDERS_MANAGE_STATUS)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[OrderResponse]:
    result = await service.change_order_status(
        session=session, order=order, status_data=status_in, actor=current_user
    )
    return build_response(result)


@router.get("/{order_id}/events", response_model=SuccessListResponse[OrderEventResponse])
async def read_order_events(
    request: Request,
    order_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[OrderEventResponse]:
    order = await service.order_crud.get_order_by_identifier(session, order_id)
    if not order:
        raise NotFoundException(detail="Order not found")

    await verify_order_read_access(session, order, current_user)

    events = await service.get_order_events(session=session, order_id=order.id)
    return build_list_response(
        data=events, total=len(events), page=1, size=len(events) or 1, request=request
    )


@router.post("/{order_id}/cancel", response_model=SuccessResponse[OrderResponse])
async def cancel_order(
    order_id: str,
    cancel_in: OrderCancelRequest,
    current_user: User = Depends(require_permission(Permission.ORDERS_READ_OWN)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[OrderResponse]:
    result = await service.cancel_order(
        session=session,
        identifier=order_id,
        user_id=current_user.id,
        cancel_data=cancel_in,
    )
    return build_response(result)


@router.post("/{order_id}/complete", response_model=SuccessResponse[OrderResponse])
async def complete_order(
    order_id: str,
    current_user: User = Depends(require_permission(Permission.ORDERS_READ_OWN)),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[OrderResponse]:
    result = await service.complete_order(
        session=session, identifier=order_id, user_id=current_user.id
    )
    return build_response(result)


@router.get("/{order_id}", response_model=SuccessResponse[OrderResponse])
async def read_order(
    order_id: str,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[OrderResponse]:
    order = await service.order_crud.get_order_by_identifier(session, order_id)
    if not order:
        raise NotFoundException(detail="Order not found")

    await verify_order_read_access(session, order, current_user)

    return build_response(OrderResponse.model_validate(order))
