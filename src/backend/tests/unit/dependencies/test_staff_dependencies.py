import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.staff.dependencies import (
    get_restaurant_or_404,
    get_valid_staff_request,
    is_need_staff_for_restaurant,
)
from features.staff.exceptions import StaffRequestNotFoundException
from shared.exceptions import AccessDeniedException, NotFoundException


class TestGetValidStaffRequest:
    @pytest.mark.asyncio
    async def test_not_found(self):
        with patch(
            "features.staff.dependencies.crud.get_request_by_id",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(StaffRequestNotFoundException):
                await get_valid_staff_request(uuid.uuid4(), MagicMock(), MagicMock())

    @pytest.mark.asyncio
    async def test_forbidden(self):
        req = MagicMock(restaurant_id=uuid.uuid4())
        mock_vendor = MagicMock(id=uuid.uuid4())
        mock_rest = MagicMock(vendor_id=uuid.uuid4())

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_rest
        mock_session.execute.return_value = mock_result

        with patch(
            "features.staff.dependencies.crud.get_request_by_id",
            new_callable=AsyncMock,
            return_value=req,
        ):
            with pytest.raises(AccessDeniedException):
                await get_valid_staff_request(uuid.uuid4(), mock_session, mock_vendor)

    @pytest.mark.asyncio
    async def test_success(self):
        req = MagicMock(restaurant_id=uuid.uuid4())
        mock_vendor = MagicMock(id=uuid.uuid4())
        mock_rest = MagicMock(vendor_id=mock_vendor.id)

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_rest
        mock_session.execute.return_value = mock_result

        with patch(
            "features.staff.dependencies.crud.get_request_by_id",
            new_callable=AsyncMock,
            return_value=req,
        ):
            res = await get_valid_staff_request(uuid.uuid4(), mock_session, mock_vendor)
            assert res == req


class TestGetRestaurantOr404:
    @pytest.mark.asyncio
    async def test_not_found(self):
        mock_session = AsyncMock()
        mock_session.get.return_value = None
        with pytest.raises(NotFoundException):
            await get_restaurant_or_404(uuid.uuid4(), mock_session)


class TestIsNeedStaff:
    @pytest.mark.asyncio
    async def test_is_need_staff(self):
        mock_rest = MagicMock(is_hiring=True)
        with patch(
            "features.staff.dependencies.get_restaurant_or_404",
            new_callable=AsyncMock,
            return_value=mock_rest,
        ):
            res = await is_need_staff_for_restaurant(uuid.uuid4(), MagicMock())
            assert res is True
