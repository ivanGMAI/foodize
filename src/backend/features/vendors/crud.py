import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.users.models import User
from features.vendors.models import VendorProfile
from features.vendors.schemas import VendorCreate
from shared.enums.moderation_status import ModerationStatus
from shared.enums.permissions import Permission
from shared.exceptions import NotFoundException
from shared.permissions import has_permission


async def create_vendor_profile(
    session: AsyncSession, user: User, vendor_in: VendorCreate
) -> VendorProfile:
    vendor = VendorProfile(user=user, user_id=user.id)
    if has_permission(user.permissions, Permission.VENDORS_MODERATE):
        vendor.approval_status = ModerationStatus.APPROVED.value
    session.add(vendor)
    await session.commit()
    return vendor


async def get_vendor_by_user_id(session: AsyncSession, user_id: uuid.UUID) -> VendorProfile | None:
    result = await session.execute(select(VendorProfile).where(VendorProfile.user_id == user_id))
    return result.scalar_one_or_none()


async def get_vendor_by_user_id_or_404(session: AsyncSession, user_id: uuid.UUID) -> VendorProfile:
    vendor = await get_vendor_by_user_id(session, user_id)
    if not vendor:
        raise NotFoundException()
    return vendor
