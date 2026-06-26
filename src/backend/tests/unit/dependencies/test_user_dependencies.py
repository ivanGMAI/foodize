import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.users.dependencies import (
    ensure_user_not_exists_by_phone,
    get_user_by_id_or_404,
    get_user_by_phone_or_401,
)
from features.users.exceptions import UserAlreadyExistsException
from shared.exceptions import NotFoundException
from shared.exceptions.existence import InvalidCredentialsException


class TestUserDependencies:
    @pytest.mark.asyncio
    async def test_get_by_phone_401(self):
        with patch(
            "features.users.dependencies.get_user_by_phone",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(InvalidCredentialsException):
                await get_user_by_phone_or_401(MagicMock(), MagicMock())

    @pytest.mark.asyncio
    async def test_get_by_id_404(self):
        with patch(
            "features.users.dependencies.get_user_by_id",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(NotFoundException):
                await get_user_by_id_or_404(MagicMock(), uuid.uuid4())

    @pytest.mark.asyncio
    async def test_ensure_not_exists_raises(self):
        with patch(
            "features.users.dependencies.get_user_by_phone",
            new_callable=AsyncMock,
            return_value=MagicMock(),
        ):
            with pytest.raises(UserAlreadyExistsException):
                await ensure_user_not_exists_by_phone(MagicMock(), "123")
