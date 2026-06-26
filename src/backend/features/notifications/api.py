import uuid

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from database import db_helper
from features.auth.service import get_current_user
from features.notifications import crud
from features.notifications.schemas import (
    NotificationListResponse,
    NotificationResponse,
)
from features.users.models import User
from shared.exceptions import NotFoundException

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
async def get_my_notifications(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> NotificationListResponse:
    offset = (page - 1) * size
    items, total = await crud.get_user_notifications(session, user.id, limit=size, offset=offset)
    unread_count = await crud.get_unread_count(session, user.id)

    return NotificationListResponse(
        items=[NotificationResponse.model_validate(item) for item in items],
        total=total,
        unread_count=unread_count,
    )


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def read_notification(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> NotificationResponse:
    notification = await crud.mark_as_read(session, notification_id, user.id)
    if not notification:
        raise NotFoundException(detail="Notification not found")
    return NotificationResponse.model_validate(notification)


@router.post("/read-all")
async def read_all_notifications(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> dict:
    await crud.mark_all_as_read(session, user.id)
    return {"success": True}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> None:
    deleted = await crud.delete_notification(session, notification_id, user.id)
    if not deleted:
        raise NotFoundException(detail="Notification not found")


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_all_notifications(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
) -> None:
    await crud.delete_all_notifications(session, user.id)
