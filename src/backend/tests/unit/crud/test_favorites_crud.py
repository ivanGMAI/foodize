import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from features.favorites.crud import (
    count_favorites_by_user,
    delete_favorite,
    get_favorite,
    get_favorites_by_user,
)


class TestGetFavorite:
    @pytest.mark.asyncio
    async def test_found(self):
        fav = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=fav)

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await get_favorite(session, uuid.uuid4(), uuid.uuid4())
        assert result == fav

    @pytest.mark.asyncio
    async def test_not_found(self):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await get_favorite(session, uuid.uuid4(), uuid.uuid4())
        assert result is None


class TestGetFavoritesByUser:
    @pytest.mark.asyncio
    async def test_success(self):
        fav = MagicMock()
        mock_result = MagicMock()
        mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[fav])))

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await get_favorites_by_user(session, uuid.uuid4())
        assert result == [fav]

    @pytest.mark.asyncio
    async def test_empty(self):
        mock_result = MagicMock()
        mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[])))

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await get_favorites_by_user(session, uuid.uuid4())
        assert result == []


class TestCountFavoritesByUser:
    @pytest.mark.asyncio
    async def test_count(self):
        mock_result = MagicMock()
        mock_result.scalar_one = MagicMock(return_value=3)

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await count_favorites_by_user(session, uuid.uuid4())
        assert result == 3


class TestDeleteFavorite:
    @pytest.mark.asyncio
    async def test_deletes_and_commits(self):
        fav = MagicMock()

        session = AsyncMock()
        session.delete = AsyncMock()
        session.commit = AsyncMock()

        await delete_favorite(session, fav)
        session.delete.assert_awaited_once_with(fav)
        session.commit.assert_awaited_once()
