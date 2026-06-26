import logging
import uuid
from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.admin import crud, service
from features.admin import export as admin_export
from features.admin.audit_log import service as audit_service
from features.admin.audit_log.models import AuditLog
from features.admin.dependencies import require_admin
from features.admin.schemas import (
    AdminRestaurantResponse,
    AdminReviewResponse,
    AdminUserResponse,
    AdminVendorResponse,
    AdvancedAnalytics,
    FinanceAnalytics,
    ModerationDecision,
    PlatformStats,
)
from features.orders.schemas.order import OrderResponse
from features.users.models import User
from shared.enums.moderation_status import ModerationStatus
from shared.enums.order_status import OrderStatus
from shared.enums.permissions import Permission
from shared.permissions import (
    ADMIN_PERMISSIONS,
    CUSTOMER_PERMISSIONS,
    serialize_permissions,
)
from shared.response import build_list_response, build_response
from shared.schemas.response import SuccessListResponse, SuccessResponse

logger = logging.getLogger(__name__)


class SetPermissionsRequest(BaseModel):
    permissions: list[Permission]


class BatchIdsRequest(BaseModel):
    ids: list[uuid.UUID]


class BatchRejectRequest(BaseModel):
    ids: list[uuid.UUID]
    reason: str | None = None


router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/users", response_model=SuccessListResponse[AdminUserResponse])
async def read_users(
    request: Request,
    role: str | None = Query(None),
    search: str | None = Query(None, max_length=128),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[AdminUserResponse]:
    offset = (page - 1) * size
    data, total = await service.get_users_list(session, role, offset, size, search=search)
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.post("/users/batch-deactivate")
async def batch_deactivate_users(
    body: BatchIdsRequest,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> dict:
    count = await crud.batch_deactivate_users(session, body.ids)
    await session.commit()
    return {"affected": count}


@router.post("/users/batch-activate")
async def batch_activate_users(
    body: BatchIdsRequest,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> dict:
    count = await crud.batch_activate_users(session, body.ids)
    await session.commit()
    return {"affected": count}


@router.get("/users/{user_id}", response_model=SuccessResponse[AdminUserResponse])
async def read_user(
    user_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminUserResponse]:
    result = await service.get_user_or_404(session, user_id)
    return build_response(result)


@router.delete("/users/{user_id}", response_model=SuccessResponse[AdminUserResponse])
async def delete_user(
    user_id: uuid.UUID,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminUserResponse]:
    result = await service.deactivate_user_service(session, user_id)
    await audit_service.log_action(session, actor.id, "DEACTIVATE_USER", "user", user_id)
    await session.commit()
    return build_response(result)


@router.post("/users/{user_id}/activate", response_model=SuccessResponse[AdminUserResponse])
async def activate_user(
    user_id: uuid.UUID,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminUserResponse]:
    result = await service.activate_user_service(session, user_id)
    await audit_service.log_action(session, actor.id, "ACTIVATE_USER", "user", user_id)
    await session.commit()
    return build_response(result)


@router.post("/users/{user_id}/grant-admin", response_model=SuccessResponse[AdminUserResponse])
async def grant_admin_permissions(
    user_id: uuid.UUID,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminUserResponse]:
    result = await service.set_user_permissions(
        session, user_id, serialize_permissions(ADMIN_PERMISSIONS), actor_id=actor.id
    )
    return build_response(result)


@router.post("/users/{user_id}/permissions", response_model=SuccessResponse[AdminUserResponse])
async def change_user_permissions(
    user_id: uuid.UUID,
    body: SetPermissionsRequest,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminUserResponse]:
    result = await service.set_user_permissions(
        session, user_id, body.permissions, actor_id=actor.id
    )
    return build_response(result)


@router.post("/me/reset-permissions", response_model=SuccessResponse[AdminUserResponse])
async def reset_my_permissions(
    user: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminUserResponse]:
    result = await service.set_user_permissions(
        session, user.id, serialize_permissions(CUSTOMER_PERMISSIONS), actor_id=user.id
    )
    return build_response(result)


@router.get("/orders", response_model=SuccessListResponse[OrderResponse])
async def read_orders(
    request: Request,
    status: OrderStatus | None = Query(None),
    restaurant_id: uuid.UUID | None = Query(None),
    user_id: uuid.UUID | None = Query(None),
    search: str | None = Query(None, max_length=128),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[OrderResponse]:
    offset = (page - 1) * size
    data, total = await service.get_orders_list(
        session=session,
        status=status,
        restaurant_id=restaurant_id,
        user_id=user_id,
        search=search,
        date_from=date_from,
        date_to=date_to,
        offset=offset,
        limit=size,
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.get("/restaurants", response_model=SuccessListResponse[AdminRestaurantResponse])
async def read_restaurants(
    request: Request,
    search: str | None = Query(None, max_length=128),
    vendor_search: str | None = Query(None, max_length=128),
    is_open: bool | None = Query(None),
    moderation_status: str | None = Query(None),
    min_rating: float | None = Query(None, ge=1, le=5),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[AdminRestaurantResponse]:
    offset = (page - 1) * size
    data, total = await service.get_restaurants_list(
        session,
        search=search,
        vendor_search=vendor_search,
        is_open=is_open,
        moderation_status=moderation_status,
        min_rating=min_rating,
        offset=offset,
        limit=size,
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.post("/restaurants/batch-approve")
async def batch_approve_restaurants(
    body: BatchIdsRequest,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[dict]:
    approved, failed = [], []
    for rid in body.ids:
        try:
            await service.moderate_restaurant(session, rid, ModerationStatus.APPROVED.value)
            await audit_service.log_action(
                session, actor.id, "APPROVE_RESTAURANT", "restaurant", rid
            )
            approved.append(str(rid))
        except Exception:
            logger.exception("batch_approve_restaurants failed for id=%s", rid)
            failed.append(str(rid))
    await session.commit()
    return build_response({"approved": approved, "failed": failed})


@router.post("/restaurants/batch-reject")
async def batch_reject_restaurants(
    body: BatchRejectRequest,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[dict]:
    rejected, failed = [], []
    for rid in body.ids:
        try:
            await service.moderate_restaurant(
                session, rid, ModerationStatus.REJECTED.value, body.reason
            )
            await audit_service.log_action(
                session, actor.id, "REJECT_RESTAURANT", "restaurant", rid, {"reason": body.reason}
            )
            rejected.append(str(rid))
        except Exception:
            logger.exception("batch_reject_restaurants failed for id=%s", rid)
            failed.append(str(rid))
    await session.commit()
    return build_response({"rejected": rejected, "failed": failed})


@router.get(
    "/restaurants/{restaurant_id}",
    response_model=SuccessResponse[AdminRestaurantResponse],
)
async def read_restaurant(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminRestaurantResponse]:
    result = await service.get_restaurant_or_404(session, restaurant_id)
    return build_response(result)


@router.delete(
    "/restaurants/{restaurant_id}",
    response_model=SuccessResponse[AdminRestaurantResponse],
)
async def delete_restaurant(
    restaurant_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminRestaurantResponse]:
    result = await service.delete_restaurant_service(session, restaurant_id)
    return build_response(result)


@router.post(
    "/restaurants/{restaurant_id}/approve",
    response_model=SuccessResponse[AdminRestaurantResponse],
)
async def approve_restaurant(
    restaurant_id: uuid.UUID,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminRestaurantResponse]:
    result = await service.moderate_restaurant(
        session, restaurant_id, ModerationStatus.APPROVED.value, actor_id=actor.id
    )
    return build_response(result)


@router.post(
    "/restaurants/{restaurant_id}/reject",
    response_model=SuccessResponse[AdminRestaurantResponse],
)
async def reject_restaurant(
    restaurant_id: uuid.UUID,
    body: ModerationDecision,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminRestaurantResponse]:
    result = await service.moderate_restaurant(
        session, restaurant_id, ModerationStatus.REJECTED.value, body.reason, actor_id=actor.id
    )
    return build_response(result)


@router.get("/vendors", response_model=SuccessListResponse[AdminVendorResponse])
async def read_vendors(
    request: Request,
    search: str | None = Query(None, max_length=128),
    approval_status: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[AdminVendorResponse]:
    offset = (page - 1) * size
    data, total = await service.get_vendors_list(
        session,
        search=search,
        approval_status=approval_status,
        offset=offset,
        limit=size,
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.post("/vendors/batch-approve")
async def batch_approve_vendors(
    body: BatchIdsRequest,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[dict]:
    approved, failed = [], []
    for vid in body.ids:
        try:
            await service.moderate_vendor(session, vid, ModerationStatus.APPROVED.value)
            await audit_service.log_action(session, actor.id, "APPROVE_VENDOR", "vendor", vid)
            approved.append(str(vid))
        except Exception:
            logger.exception("batch_approve_vendors failed for id=%s", vid)
            failed.append(str(vid))
    await session.commit()
    return build_response({"approved": approved, "failed": failed})


@router.post("/vendors/batch-reject")
async def batch_reject_vendors(
    body: BatchRejectRequest,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[dict]:
    rejected, failed = [], []
    for vid in body.ids:
        try:
            await service.moderate_vendor(
                session, vid, ModerationStatus.REJECTED.value, body.reason
            )
            await audit_service.log_action(
                session, actor.id, "REJECT_VENDOR", "vendor", vid, {"reason": body.reason}
            )
            rejected.append(str(vid))
        except Exception:
            logger.exception("batch_reject_vendors failed for id=%s", vid)
            failed.append(str(vid))
    await session.commit()
    return build_response({"rejected": rejected, "failed": failed})


@router.get("/vendors/{vendor_id}", response_model=SuccessResponse[AdminVendorResponse])
async def read_vendor(
    vendor_id: uuid.UUID,
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminVendorResponse]:
    result = await service.get_vendor_or_404(session, vendor_id)
    return build_response(result)


@router.delete("/vendors/{vendor_id}", response_model=SuccessResponse[AdminVendorResponse])
async def delete_vendor(
    vendor_id: uuid.UUID,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminVendorResponse]:
    result = await service.delete_vendor_service(session, vendor_id)
    await audit_service.log_action(session, actor.id, "DEACTIVATE_VENDOR", "vendor", vendor_id)
    await session.commit()
    return build_response(result)


@router.post("/vendors/{vendor_id}/approve", response_model=SuccessResponse[AdminVendorResponse])
async def approve_vendor(
    vendor_id: uuid.UUID,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminVendorResponse]:
    result = await service.moderate_vendor(
        session, vendor_id, ModerationStatus.APPROVED.value, actor_id=actor.id
    )
    return build_response(result)


@router.post("/vendors/{vendor_id}/reject", response_model=SuccessResponse[AdminVendorResponse])
async def reject_vendor(
    vendor_id: uuid.UUID,
    body: ModerationDecision,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminVendorResponse]:
    result = await service.moderate_vendor(
        session, vendor_id, ModerationStatus.REJECTED.value, body.reason, actor_id=actor.id
    )
    return build_response(result)


@router.get("/reviews", response_model=SuccessListResponse[AdminReviewResponse])
async def read_reviews(
    request: Request,
    rating: int | None = Query(None, ge=1, le=5),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessListResponse[AdminReviewResponse]:
    offset = (page - 1) * size
    data, total = await service.get_reviews_list(
        session,
        rating=rating,
        offset=offset,
        limit=size,
    )
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.delete("/reviews/batch")
async def batch_delete_reviews(
    body: BatchIdsRequest,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> dict:
    count = await crud.batch_delete_reviews(session, body.ids)
    for rid in body.ids:
        await audit_service.log_action(session, actor.id, "DELETE_REVIEW", "review", rid)
    await session.commit()
    return {"affected": count}


@router.delete("/reviews/{review_id}", response_model=SuccessResponse[AdminReviewResponse])
async def delete_review(
    review_id: uuid.UUID,
    actor: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdminReviewResponse]:
    result = await service.delete_review_service(session, review_id)
    await audit_service.log_action(session, actor.id, "DELETE_REVIEW", "review", review_id)
    await session.commit()
    return build_response(result)


@router.get("/stats", response_model=SuccessResponse[PlatformStats])
async def read_platform_stats(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[PlatformStats]:
    result = await service.get_stats(session)
    return build_response(result)


@router.get("/finance", response_model=SuccessResponse[FinanceAnalytics])
async def read_finance(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    restaurant_id: uuid.UUID | None = Query(None),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[FinanceAnalytics]:
    result = await service.get_finance(
        session, date_from=date_from, date_to=date_to, restaurant_id=restaurant_id
    )
    return build_response(result)


@router.get("/analytics", response_model=SuccessResponse[AdvancedAnalytics])
async def read_advanced_analytics(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    restaurant_id: uuid.UUID | None = Query(None),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> SuccessResponse[AdvancedAnalytics]:
    result = await service.get_advanced_analytics(
        session, date_from=date_from, date_to=date_to, restaurant_id=restaurant_id
    )
    return build_response(result)


@router.get("/audit-logs")
async def get_audit_logs(
    request: Request,
    action: str | None = Query(None),
    entity_type: str | None = Query(None),
    actor_id: uuid.UUID | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
):
    stmt = select(AuditLog).order_by(AuditLog.created_at.desc())
    count_stmt = select(func.count()).select_from(AuditLog)
    if action:
        stmt = stmt.where(AuditLog.action == action)
        count_stmt = count_stmt.where(AuditLog.action == action)
    if entity_type:
        stmt = stmt.where(AuditLog.entity_type == entity_type)
        count_stmt = count_stmt.where(AuditLog.entity_type == entity_type)
    if actor_id:
        stmt = stmt.where(AuditLog.actor_id == actor_id)
        count_stmt = count_stmt.where(AuditLog.actor_id == actor_id)
    if date_from:
        stmt = stmt.where(
            AuditLog.created_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=UTC)
        )
        count_stmt = count_stmt.where(
            AuditLog.created_at >= datetime.combine(date_from, datetime.min.time(), tzinfo=UTC)
        )
    if date_to:
        stmt = stmt.where(
            AuditLog.created_at
            < datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=UTC)
        )
        count_stmt = count_stmt.where(
            AuditLog.created_at
            < datetime.combine(date_to + timedelta(days=1), datetime.min.time(), tzinfo=UTC)
        )

    total = (await session.execute(count_stmt)).scalar_one()
    offset = (page - 1) * size
    rows = (await session.execute(stmt.offset(offset).limit(size))).scalars().all()
    data = [
        {
            "id": str(r.id),
            "actor_id": str(r.actor_id) if r.actor_id else None,
            "action": r.action,
            "entity_type": r.entity_type,
            "entity_id": str(r.entity_id) if r.entity_id else None,
            "details": r.details,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]
    return build_list_response(data=data, total=total, page=page, size=size, request=request)


@router.get("/export/users.csv")
async def export_users_csv(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    data = await admin_export.export_users_csv(session)
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=users.csv"},
    )


@router.get("/export/orders.csv")
async def export_orders_csv(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    status: str | None = Query(None),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    order_status = None
    if status:
        try:
            order_status = OrderStatus(status)
        except ValueError:
            pass
    data = await admin_export.export_orders_csv(
        session, date_from=date_from, date_to=date_to, status=order_status
    )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders.csv"},
    )


@router.get("/export/restaurants.csv")
async def export_restaurants_csv(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    data = await admin_export.export_restaurants_csv(session)
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=restaurants.csv"},
    )


@router.get("/export/vendors.csv")
async def export_vendors_csv(
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    data = await admin_export.export_vendors_csv(session)
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=vendors.csv"},
    )


@router.get("/export/reviews.csv")
async def export_reviews_csv(
    min_rating: int | None = Query(None),
    max_rating: int | None = Query(None),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    data = await admin_export.export_reviews_csv(
        session, min_rating=min_rating, max_rating=max_rating
    )
    return Response(
        content=data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reviews.csv"},
    )


@router.get("/export/finance.pdf")
async def export_finance_pdf(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    data = await admin_export.export_finance_pdf(session, date_from=date_from, date_to=date_to)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=finance.pdf"},
    )


@router.get("/export/analytics.pdf")
async def export_analytics_pdf(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    data = await admin_export.export_analytics_pdf(session, date_from=date_from, date_to=date_to)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=analytics.pdf"},
    )


@router.get("/export/overview.pdf")
async def export_overview_pdf(
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    _: User = Depends(require_admin),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> Response:
    data = await admin_export.export_overview_pdf(session, date_from=date_from, date_to=date_to)
    return Response(
        content=data,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=overview.pdf"},
    )
