import os
import sys
from collections.abc import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from factories import make_user

from database.db_helper import db_helper
from features.auth.service import get_current_user
from features.orders.models import Order
from features.users.models import User
from main import app
from shared.enums.roles import UserRole

_order_display_id = 1000


@event.listens_for(Order, "before_insert")
def _set_order_display_id_for_sqlite_tests(mapper, connection, target) -> None:
    global _order_display_id
    if target.display_id is None:
        target.display_id = _order_display_id
        _order_display_id += 1


@pytest_asyncio.fixture
async def mock_db_session() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    session.add_all = MagicMock()
    return session


@pytest_asyncio.fixture
async def client(mock_db_session: AsyncMock) -> AsyncGenerator[AsyncClient, None]:
    async def _override_session():
        yield mock_db_session

    app.dependency_overrides[db_helper.dependency_session_getter] = _override_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def default_user() -> User:
    return make_user()


@pytest.fixture
def vendor_user() -> User:
    return make_user(user_role=UserRole.VENDOR.value)


@pytest.fixture
def admin_user() -> User:
    return make_user(user_role=UserRole.ADMIN.value)


@pytest.fixture
def as_user(default_user: User):
    app.dependency_overrides[get_current_user] = lambda: default_user
    yield default_user
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_vendor(vendor_user: User):
    app.dependency_overrides[get_current_user] = lambda: vendor_user
    yield vendor_user
    app.dependency_overrides.pop(get_current_user, None)


@pytest.fixture
def as_admin(admin_user: User):
    app.dependency_overrides[get_current_user] = lambda: admin_user
    yield admin_user
    app.dependency_overrides.pop(get_current_user, None)
