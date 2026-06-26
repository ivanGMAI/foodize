import uuid

import pytest
import pytest_asyncio

from features.auth.service import get_current_user
from features.vendors.dependencies import get_current_vendor
from features.vendors.models import VendorProfile
from main import app
from shared.enums.moderation_status import ModerationStatus


def make_mock_vendor_profile(user_id: uuid.UUID | None = None):
    vendor = VendorProfile()
    vendor.id = uuid.uuid4()
    vendor.user_id = user_id or uuid.uuid4()
    vendor.approval_status = ModerationStatus.PENDING.value
    vendor.rejection_reason = None
    return vendor


@pytest.fixture
def mock_vendor_profile():
    return make_mock_vendor_profile()


@pytest_asyncio.fixture
async def vendor_client(client, mock_vendor_profile, vendor_user):
    app.dependency_overrides[get_current_user] = lambda: vendor_user
    app.dependency_overrides[get_current_vendor] = lambda: mock_vendor_profile
    yield client, mock_vendor_profile
    app.dependency_overrides.pop(get_current_vendor, None)
    app.dependency_overrides.pop(get_current_user, None)
