from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.users.crud import update_user, update_user_password
from features.users.schemas import UserUpdate


class TestUsersCrud:
    @pytest.mark.asyncio
    async def test_update_user(self):
        user = MagicMock()
        user.name = "old"
        update_data = UserUpdate(name="new name")

        session = AsyncMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()

        await update_user(session, user, update_data)
        assert user.name == "new name"
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_update_user_password(self):
        user = MagicMock()
        user.hashed_password = "old_hash"

        session = AsyncMock()
        session.commit = AsyncMock()

        with patch("features.users.crud.hash_password", return_value="new_hash"):
            await update_user_password(session, user, "newpassword")

        assert user.hashed_password == "new_hash"
        session.commit.assert_awaited_once()
