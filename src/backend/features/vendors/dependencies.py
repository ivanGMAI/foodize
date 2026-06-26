from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import db_helper
from features.auth.service import get_current_user
from features.users.models import User
from features.vendors.crud import get_vendor_by_user_id
from features.vendors.exceptions import VendorAlreadyExistsException
from features.vendors.models import VendorProfile
from shared.enums.moderation_status import ModerationStatus
from shared.enums.permissions import Permission
from shared.exceptions import NotFoundException
from shared.exceptions.rules import AccessDeniedException
from shared.permissions import has_permission


def _is_admin(user: User) -> bool:
    return has_permission(user.permissions, Permission.ADMIN_ACCESS)


async def _ensure_admin_vendor_profile(
    session: AsyncSession,
    user: User,
) -> VendorProfile:
    stmt = select(User).where(User.id == user.id).options(selectinload(User.vendor_profile))
    result = await session.execute(stmt)
    loaded_user = result.scalar_one_or_none()
    if not loaded_user:
        raise NotFoundException(detail="User not found")

    vendor = loaded_user.vendor_profile
    if not vendor:
        vendor = VendorProfile(
            user=loaded_user,
            user_id=loaded_user.id,
            approval_status=ModerationStatus.APPROVED.value,
            rejection_reason=None,
        )
        session.add(vendor)
    elif vendor.approval_status != ModerationStatus.APPROVED.value or vendor.rejection_reason:
        vendor.approval_status = ModerationStatus.APPROVED.value
        vendor.rejection_reason = None

    await session.commit()
    await session.refresh(vendor)
    vendor.user = loaded_user
    return vendor


async def get_current_vendor(
    session: AsyncSession = Depends(db_helper.dependency_session_getter),
    user: User = Depends(get_current_user),
) -> VendorProfile:
    if not has_permission(user.permissions, Permission.VENDORS_READ_OWN):
        raise AccessDeniedException(detail="Insufficient permissions to access vendor profile")

    stmt = select(User).where(User.id == user.id).options(selectinload(User.vendor_profile))
    result = await session.execute(stmt)
    loaded_user = result.scalar_one_or_none()
    if not loaded_user or not loaded_user.vendor_profile:
        if _is_admin(user):
            return await _ensure_admin_vendor_profile(session, user)
        raise NotFoundException(detail="Vendor profile not found")
    vendor = loaded_user.vendor_profile
    if _is_admin(user) and (
        vendor.approval_status != ModerationStatus.APPROVED.value or vendor.rejection_reason
    ):
        return await _ensure_admin_vendor_profile(session, user)
    return vendor


async def get_vendor_or_404(user: User, session: AsyncSession) -> VendorProfile:
    vendor = await get_vendor_by_user_id(session, user.id)
    if not vendor:
        raise NotFoundException()
    return vendor


async def ensure_no_vendor_profile(user: User, session: AsyncSession) -> User:
    vendor = await get_vendor_by_user_id(session, user.id)
    if vendor:
        raise VendorAlreadyExistsException()
    return user
