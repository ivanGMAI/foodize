import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.staff.service import (
    create_staff_request,
    get_vendor_staff_requests,
    process_staff_request,
)
from shared.enums.staff_request_status import StaffRequestStatus


def _make_staff_request(
    status: StaffRequestStatus = StaffRequestStatus.PENDING,
) -> MagicMock:
    r = MagicMock()
    r.id = uuid.uuid4()
    r.user_id = uuid.uuid4()
    r.restaurant_id = uuid.uuid4()
    r.message = None
    r.status = status
    return r


class TestCreateStaffRequest:
    @pytest.mark.asyncio
    async def test_success(self):
        from features.staff.schemas import StaffRequestCreate

        user_id = uuid.uuid4()
        restaurant_id = uuid.uuid4()
        request_data = StaffRequestCreate(message="Хочу работать")

        mock_request = _make_staff_request(StaffRequestStatus.PENDING)

        with (
            patch(
                "features.staff.service.is_need_staff_for_restaurant",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "features.staff.crud.get_staff_profile_by_user_id",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "features.staff.crud.get_last_request",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "features.staff.crud.create_staff_request",
                new_callable=AsyncMock,
                return_value=mock_request,
            ),
        ):
            result = await create_staff_request(MagicMock(), user_id, restaurant_id, request_data)
            assert result.user_id == mock_request.user_id

    @pytest.mark.asyncio
    async def test_not_hiring(self):
        from features.staff.exceptions import RestaurantNotHiringException
        from features.staff.schemas import StaffRequestCreate

        with patch(
            "features.staff.service.is_need_staff_for_restaurant",
            new_callable=AsyncMock,
            return_value=False,
        ):
            with pytest.raises(RestaurantNotHiringException):
                await create_staff_request(
                    MagicMock(), uuid.uuid4(), uuid.uuid4(), StaffRequestCreate()
                )

    @pytest.mark.asyncio
    async def test_already_staff(self):
        from features.staff.exceptions import AlreadyStaffException
        from features.staff.schemas import StaffRequestCreate

        with (
            patch(
                "features.staff.service.is_need_staff_for_restaurant",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "features.staff.crud.get_staff_profile_by_user_id",
                new_callable=AsyncMock,
                return_value=MagicMock(),
            ),
        ):
            with pytest.raises(AlreadyStaffException):
                await create_staff_request(
                    MagicMock(), uuid.uuid4(), uuid.uuid4(), StaffRequestCreate()
                )

    @pytest.mark.asyncio
    async def test_active_request_exists(self):
        from features.staff.exceptions import StaffRequestActiveExistsException
        from features.staff.schemas import StaffRequestCreate

        last = MagicMock()
        last.status = StaffRequestStatus.PENDING.value

        with (
            patch(
                "features.staff.service.is_need_staff_for_restaurant",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "features.staff.crud.get_staff_profile_by_user_id",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "features.staff.crud.get_last_request",
                new_callable=AsyncMock,
                return_value=last,
            ),
        ):
            with pytest.raises(StaffRequestActiveExistsException):
                await create_staff_request(
                    MagicMock(), uuid.uuid4(), uuid.uuid4(), StaffRequestCreate()
                )

    @pytest.mark.asyncio
    async def test_cooldown_after_rejection(self):
        from features.staff.exceptions import StaffRequestCooldownException
        from features.staff.schemas import StaffRequestCreate

        last = MagicMock()
        last.status = StaffRequestStatus.REJECTED.value
        last.updated_at = datetime.now(timezone.utc) - timedelta(hours=1)

        with (
            patch(
                "features.staff.service.is_need_staff_for_restaurant",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "features.staff.crud.get_staff_profile_by_user_id",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "features.staff.crud.get_last_request",
                new_callable=AsyncMock,
                return_value=last,
            ),
        ):
            with pytest.raises(StaffRequestCooldownException):
                await create_staff_request(
                    MagicMock(), uuid.uuid4(), uuid.uuid4(), StaffRequestCreate()
                )

    @pytest.mark.asyncio
    async def test_after_cooldown_passes(self):
        from features.staff.schemas import StaffRequestCreate

        last = MagicMock()
        last.status = StaffRequestStatus.REJECTED.value
        last.updated_at = datetime.now(timezone.utc) - timedelta(hours=25)

        mock_request = _make_staff_request(StaffRequestStatus.PENDING)

        with (
            patch(
                "features.staff.service.is_need_staff_for_restaurant",
                new_callable=AsyncMock,
                return_value=True,
            ),
            patch(
                "features.staff.crud.get_staff_profile_by_user_id",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "features.staff.crud.get_last_request",
                new_callable=AsyncMock,
                return_value=last,
            ),
            patch(
                "features.staff.crud.create_staff_request",
                new_callable=AsyncMock,
                return_value=mock_request,
            ),
        ):
            result = await create_staff_request(
                MagicMock(), uuid.uuid4(), uuid.uuid4(), StaffRequestCreate()
            )
            assert result.id == mock_request.id


class TestProcessStaffRequest:
    @pytest.mark.asyncio
    async def test_none_request_returns_none(self):
        result = await process_staff_request(MagicMock(), None, StaffRequestStatus.ACCEPTED)
        assert result is None

    @pytest.mark.asyncio
    async def test_accept_success(self):
        request = MagicMock()
        request.user_id = uuid.uuid4()
        request.restaurant_id = uuid.uuid4()

        updated = _make_staff_request(StaffRequestStatus.ACCEPTED)

        with (
            patch(
                "features.staff.crud.get_staff_profile_by_user_id",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch("features.staff.crud.create_staff_profile", new_callable=AsyncMock),
            patch(
                "features.staff.crud.update_request_status",
                new_callable=AsyncMock,
                return_value=updated,
            ),
        ):
            result = await process_staff_request(MagicMock(), request, StaffRequestStatus.ACCEPTED)
            assert result.status == StaffRequestStatus.ACCEPTED

    @pytest.mark.asyncio
    async def test_accept_already_staff(self):
        from features.staff.exceptions import AlreadyStaffException

        request = MagicMock()
        request.user_id = uuid.uuid4()

        with (
            patch(
                "features.staff.crud.get_staff_profile_by_user_id",
                new_callable=AsyncMock,
                return_value=MagicMock(),
            ),
            patch("features.staff.crud.update_request_status", new_callable=AsyncMock),
        ):
            with pytest.raises(AlreadyStaffException):
                await process_staff_request(MagicMock(), request, StaffRequestStatus.ACCEPTED)

    @pytest.mark.asyncio
    async def test_reject_success(self):
        request = MagicMock()
        updated = _make_staff_request(StaffRequestStatus.REJECTED)

        with patch(
            "features.staff.crud.update_request_status",
            new_callable=AsyncMock,
            return_value=updated,
        ):
            result = await process_staff_request(MagicMock(), request, StaffRequestStatus.REJECTED)
            assert result.status == StaffRequestStatus.REJECTED


class TestGetVendorStaffRequests:
    @pytest.mark.asyncio
    async def test_success(self):
        vendor_id = uuid.uuid4()
        r = _make_staff_request()

        with (
            patch(
                "features.staff.crud.get_requests_by_vendor_id",
                new_callable=AsyncMock,
                return_value=[r],
            ),
            patch(
                "features.staff.crud.count_requests_by_vendor_id",
                new_callable=AsyncMock,
                return_value=1,
            ),
        ):
            data, total = await get_vendor_staff_requests(MagicMock(), vendor_id)
            assert len(data) == 1
            assert total == 1

    @pytest.mark.asyncio
    async def test_empty(self):
        with (
            patch(
                "features.staff.crud.get_requests_by_vendor_id",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "features.staff.crud.count_requests_by_vendor_id",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            data, total = await get_vendor_staff_requests(MagicMock(), uuid.uuid4())
            assert data == []
            assert total == 0
