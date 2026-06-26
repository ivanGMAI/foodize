import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.staff.exceptions import (
    AlreadyStaffException,
    RestaurantNotHiringException,
    StaffRequestActiveExistsException,
    StaffRequestCooldownException,
)
from features.staff.schemas import StaffRequestCreate
from features.staff.service import create_staff_request, process_staff_request
from shared.enums.staff_request_status import StaffRequestStatus


def mock_staff_request(status=StaffRequestStatus.PENDING, updated_at=None):
    req = MagicMock()
    req.id = uuid.uuid4()
    req.user_id = uuid.uuid4()
    req.restaurant_id = uuid.uuid4()
    req.message = None
    req.status = status
    req.updated_at = updated_at or datetime.now(timezone.utc)
    return req


class TestCreateStaffRequest:
    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        self.mock_is_hiring = patch(
            "features.staff.service.is_need_staff_for_restaurant",
            new_callable=AsyncMock,
            return_value=True,
        ).start()
        self.mock_get_profile = patch(
            "features.staff.crud.get_staff_profile_by_user_id",
            new_callable=AsyncMock,
            return_value=None,
        ).start()
        self.mock_get_last = patch(
            "features.staff.crud.get_last_request",
            new_callable=AsyncMock,
            return_value=None,
        ).start()
        self.mock_create = patch(
            "features.staff.crud.create_staff_request",
            new_callable=AsyncMock,
            return_value=mock_staff_request(),
        ).start()

        yield

        patch.stopall()

    async def test_success(self, mock_db_session):
        data = StaffRequestCreate(message="Hire me")
        res = await create_staff_request(mock_db_session, uuid.uuid4(), uuid.uuid4(), data)
        assert res is not None
        self.mock_create.assert_awaited_once()

    async def test_not_hiring(self, mock_db_session):
        self.mock_is_hiring.return_value = False
        with pytest.raises(RestaurantNotHiringException):
            await create_staff_request(
                mock_db_session, uuid.uuid4(), uuid.uuid4(), StaffRequestCreate()
            )

    async def test_already_staff(self, mock_db_session):
        self.mock_get_profile.return_value = MagicMock()
        with pytest.raises(AlreadyStaffException):
            await create_staff_request(
                mock_db_session, uuid.uuid4(), uuid.uuid4(), StaffRequestCreate()
            )

    async def test_active_request_exists(self, mock_db_session):
        self.mock_get_last.return_value = mock_staff_request(status=StaffRequestStatus.PENDING)
        with pytest.raises(StaffRequestActiveExistsException):
            await create_staff_request(
                mock_db_session, uuid.uuid4(), uuid.uuid4(), StaffRequestCreate()
            )

    async def test_cooldown(self, mock_db_session):
        self.mock_get_last.return_value = mock_staff_request(
            status=StaffRequestStatus.REJECTED,
            updated_at=datetime.now(timezone.utc) - timedelta(hours=2),
        )
        with pytest.raises(StaffRequestCooldownException):
            await create_staff_request(
                mock_db_session, uuid.uuid4(), uuid.uuid4(), StaffRequestCreate()
            )


class TestProcessStaffRequest:
    @pytest.fixture(autouse=True)
    def setup_mocks(self):
        self.req_id = uuid.uuid4()
        self.req = mock_staff_request(status=StaffRequestStatus.PENDING)

        self.mock_get_profile = patch(
            "features.staff.crud.get_staff_profile_by_user_id",
            new_callable=AsyncMock,
            return_value=None,
        ).start()
        self.mock_create_profile = patch(
            "features.staff.crud.create_staff_profile",
            new_callable=AsyncMock,
            return_value=MagicMock(),
        ).start()
        self.mock_update = patch(
            "features.staff.crud.update_request_status",
            new_callable=AsyncMock,
            return_value=self.req,
        ).start()

        yield

        patch.stopall()

    async def test_not_found(self, mock_db_session):
        res = await process_staff_request(mock_db_session, None, StaffRequestStatus.ACCEPTED)
        assert res is None

    async def test_accepted_creates_profile(self, mock_db_session):
        await process_staff_request(mock_db_session, self.req, StaffRequestStatus.ACCEPTED)
        self.mock_create_profile.assert_awaited_once_with(
            mock_db_session, self.req.user_id, self.req.restaurant_id
        )
        self.mock_update.assert_awaited_once_with(
            mock_db_session, self.req, StaffRequestStatus.ACCEPTED
        )

    async def test_rejected_no_profile(self, mock_db_session):
        await process_staff_request(mock_db_session, self.req, StaffRequestStatus.REJECTED)
        self.mock_create_profile.assert_not_called()
        self.mock_update.assert_awaited_once_with(
            mock_db_session, self.req, StaffRequestStatus.REJECTED
        )

    async def test_accepted_already_staff_raises(self, mock_db_session):
        self.mock_get_profile.return_value = MagicMock()
        with pytest.raises(AlreadyStaffException):
            await process_staff_request(mock_db_session, self.req, StaffRequestStatus.ACCEPTED)

        self.mock_update.assert_awaited_once_with(
            mock_db_session, self.req, StaffRequestStatus.REJECTED
        )
