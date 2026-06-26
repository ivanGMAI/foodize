import json
import uuid
from unittest.mock import AsyncMock

import pytest

from features.cart.schemas import CartUpdate
from features.cart.service import CartService


@pytest.mark.asyncio
class TestCartService:
    @pytest.fixture
    def mock_cache(self):
        return AsyncMock()

    async def test_get_cart_cache_miss(self, mock_cache):
        mock_cache.get.return_value = None
        service = CartService(cache=mock_cache)
        user_id = uuid.uuid4()

        result = await service.get_cart(user_id)

        assert result.items == []
        assert result.restaurant_id is None
        mock_cache.get.assert_called_once()

    async def test_get_cart_cache_hit_valid_json(self, mock_cache):
        user_id = uuid.uuid4()
        cart_data = {
            "restaurant_id": str(uuid.uuid4()),
            "items": [
                {
                    "menu_item_id": str(uuid.uuid4()),
                    "name": "Pizza",
                    "price": 1000,
                    "quantity": 2,
                }
            ],
        }
        mock_cache.get.return_value = json.dumps(cart_data)
        service = CartService(cache=mock_cache)

        result = await service.get_cart(user_id)

        assert len(result.items) == 1
        assert result.items[0].quantity == 2

    async def test_get_cart_cache_malformed_json(self, mock_cache):
        mock_cache.get.return_value = "not valid json {"
        service = CartService(cache=mock_cache)
        user_id = uuid.uuid4()

        result = await service.get_cart(user_id)

        assert result.items == []
        assert result.restaurant_id is None

    async def test_get_cart_cache_non_string(self, mock_cache):
        mock_cache.get.return_value = 12345
        service = CartService(cache=mock_cache)
        user_id = uuid.uuid4()

        result = await service.get_cart(user_id)

        assert result.items == []

    async def test_update_cart(self, mock_cache):
        service = CartService(cache=mock_cache)
        user_id = uuid.uuid4()
        cart_update = CartUpdate(restaurant_id=uuid.uuid4(), items=[])

        await service.update_cart(user_id, cart_update)

        mock_cache.set.assert_called_once()
        args, kwargs = mock_cache.set.call_args
        assert str(user_id) in args[0]

    async def test_clear_cart(self, mock_cache):
        service = CartService(cache=mock_cache)
        user_id = uuid.uuid4()

        await service.clear_cart(user_id)

        mock_cache.delete.assert_called_once()
