import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.vendors.dependencies import (
    ensure_no_vendor_profile,
    get_current_vendor,
    get_vendor_or_404,
)
from features.vendors.exceptions import VendorAlreadyExistsException
from shared.enums.moderation_status import ModerationStatus
from shared.enums.permissions import Permission
from shared.enums.roles import UserRole
from shared.exceptions import AccessDeniedException, NotFoundException


class TestVendorDependencies:
    @pytest.mark.asyncio
    async def test_get_current_vendor(self):
        current_user = MagicMock(
            id=uuid.uuid4(),
            user_role=UserRole.VENDOR.value,
            permissions=[Permission.VENDORS_READ_OWN.value],
        )
        mock_user = MagicMock()
        mock_user.vendor_profile = "PROFILE"
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_session = AsyncMock()
        mock_session.execute.return_value = mock_result

        res = await get_current_vendor(mock_session, current_user)
        assert res == "PROFILE"

    @pytest.mark.asyncio
    async def test_get_current_vendor_creates_admin_profile(self):
        current_user = MagicMock(
            id=uuid.uuid4(),
            user_role=UserRole.ADMIN.value,
            permissions=[Permission.ADMIN_ACCESS.value],
        )
        mock_user = MagicMock()
        mock_user.vendor_profile = None
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_session = AsyncMock()
        mock_session.execute.return_value = mock_result

        with patch(
            "features.vendors.dependencies._ensure_admin_vendor_profile",
            new_callable=AsyncMock,
            return_value="ADMIN_PROFILE",
        ) as ensure_admin_vendor:
            res = await get_current_vendor(mock_session, current_user)

        assert res == "ADMIN_PROFILE"
        ensure_admin_vendor.assert_awaited_once_with(mock_session, current_user)

    @pytest.mark.asyncio
    async def test_get_current_vendor_approves_admin_profile(self):
        current_user = MagicMock(
            id=uuid.uuid4(),
            user_role=UserRole.ADMIN.value,
            permissions=[Permission.ADMIN_ACCESS.value],
        )
        mock_vendor = MagicMock(
            approval_status=ModerationStatus.PENDING.value,
            rejection_reason=None,
        )
        mock_user = MagicMock()
        mock_user.vendor_profile = mock_vendor
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_session = AsyncMock()
        mock_session.execute.return_value = mock_result

        with patch(
            "features.vendors.dependencies._ensure_admin_vendor_profile",
            new_callable=AsyncMock,
            return_value="ADMIN_PROFILE",
        ) as ensure_admin_vendor:
            res = await get_current_vendor(mock_session, current_user)

        assert res == "ADMIN_PROFILE"
        ensure_admin_vendor.assert_awaited_once_with(mock_session, current_user)

    @pytest.mark.asyncio
    async def test_get_current_vendor_requires_permission(self):
        current_user = MagicMock(id=uuid.uuid4(), user_role=UserRole.CUSTOMER.value)

        with pytest.raises(AccessDeniedException):
            await get_current_vendor(AsyncMock(), current_user)

    @pytest.mark.asyncio
    async def test_ensure_no_vendor_profile_raises(self):
        with patch(
            "features.vendors.dependencies.get_vendor_by_user_id",
            new_callable=AsyncMock,
            return_value=MagicMock(),
        ):
            with pytest.raises(VendorAlreadyExistsException):
                await ensure_no_vendor_profile(MagicMock(id=uuid.uuid4()), MagicMock())

    @pytest.mark.asyncio
    async def test_get_vendor_or_404_raises(self):
        with patch(
            "features.vendors.dependencies.get_vendor_by_user_id",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(NotFoundException):
                await get_vendor_or_404(MagicMock(id=uuid.uuid4()), MagicMock())
