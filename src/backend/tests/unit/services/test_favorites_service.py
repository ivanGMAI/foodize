import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.favorites.service import add_favorite, get_my_favorites, remove_favorite


def _make_favorite() -> MagicMock:
    f = MagicMock()
    f.id = uuid.uuid4()
    restaurant = MagicMock()
    restaurant.id = uuid.uuid4()
    restaurant.name = "Test Restaurant"
    restaurant.address = "ул. Тестовая 1"
    restaurant.is_open = True
    restaurant.is_hiring = False
    f.restaurant = restaurant
    f.created_at = datetime.now()
    return f


class TestAddFavorite:
    @pytest.mark.asyncio
    async def test_restaurant_not_found(self):
        from features.restaurants.exceptions import RestaurantNotFoundException

        with (
            patch(
                "features.favorites.service.restaurant_crud.get_restaurant_by_id",
                new_callable=AsyncMock,
                return_value=None,
            ),
        ):
            with pytest.raises(RestaurantNotFoundException):
                await add_favorite(MagicMock(), uuid.uuid4(), uuid.uuid4())

    @pytest.mark.asyncio
    async def test_already_favorited(self):
        from features.favorites.exceptions import AlreadyFavoritedException

        with (
            patch(
                "features.favorites.service.restaurant_crud.get_restaurant_by_id",
                new_callable=AsyncMock,
                return_value=MagicMock(),
            ),
            patch(
                "features.favorites.service.favorites_crud.get_favorite",
                new_callable=AsyncMock,
                return_value=MagicMock(),
            ),
        ):
            with pytest.raises(AlreadyFavoritedException):
                await add_favorite(MagicMock(), uuid.uuid4(), uuid.uuid4())

    @pytest.mark.asyncio
    async def test_success(self):
        fav = _make_favorite()

        with (
            patch(
                "features.favorites.service.restaurant_crud.get_restaurant_by_id",
                new_callable=AsyncMock,
                return_value=MagicMock(),
            ),
            patch(
                "features.favorites.service.favorites_crud.get_favorite",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "features.favorites.service.favorites_crud.create_favorite",
                new_callable=AsyncMock,
                return_value=fav,
            ),
        ):
            result = await add_favorite(MagicMock(), uuid.uuid4(), uuid.uuid4())
            assert result.id == fav.id


class TestRemoveFavorite:
    @pytest.mark.asyncio
    async def test_not_found(self):
        from features.favorites.exceptions import FavoriteNotFoundException

        with patch(
            "features.favorites.service.favorites_crud.get_favorite",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(FavoriteNotFoundException):
                await remove_favorite(MagicMock(), uuid.uuid4(), uuid.uuid4())

    @pytest.mark.asyncio
    async def test_success(self):
        fav = MagicMock()
        delete_mock = AsyncMock()

        with (
            patch(
                "features.favorites.service.favorites_crud.get_favorite",
                new_callable=AsyncMock,
                return_value=fav,
            ),
            patch("features.favorites.service.favorites_crud.delete_favorite", delete_mock),
        ):
            await remove_favorite(MagicMock(), uuid.uuid4(), uuid.uuid4())
            delete_mock.assert_awaited_once()


class TestGetMyFavorites:
    @pytest.mark.asyncio
    async def test_success(self):
        fav = _make_favorite()

        with (
            patch(
                "features.favorites.service.favorites_crud.get_favorites_by_user",
                new_callable=AsyncMock,
                return_value=[fav],
            ),
            patch(
                "features.favorites.service.favorites_crud.count_favorites_by_user",
                new_callable=AsyncMock,
                return_value=1,
            ),
        ):
            data, total = await get_my_favorites(MagicMock(), uuid.uuid4())
            assert len(data) == 1
            assert total == 1

    @pytest.mark.asyncio
    async def test_empty(self):
        with (
            patch(
                "features.favorites.service.favorites_crud.get_favorites_by_user",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "features.favorites.service.favorites_crud.count_favorites_by_user",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            data, total = await get_my_favorites(MagicMock(), uuid.uuid4())
            assert data == []
            assert total == 0
