import json
import logging

from fastapi import Depends

from infra.cache.base import CacheRepository
from infra.cache.redis import get_redis_cache

from .schemas import CartResponse, CartUpdate

logger = logging.getLogger(__name__)

_CART_TTL_SECONDS = 86400


class CartService:
    def __init__(self, cache: CacheRepository) -> None:
        self._cache = cache
        self._ttl = _CART_TTL_SECONDS

    def _key(self, identifier: str) -> str:
        return f"cart:{identifier}"

    async def get_cart(self, identifier: str) -> CartResponse:
        raw = await self._cache.get(self._key(identifier))
        if not raw:
            return CartResponse(restaurant_id=None, items=[])

        try:
            cart_dict = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            logger.error("Corrupted cart data for key=%s", self._key(identifier))
            return CartResponse(restaurant_id=None, items=[])

        enriched = [
            {
                "menuItem": {
                    "id": i["menu_item_id"],
                    "name": i["name"],
                    "price": i["price"],
                    "image_url": i.get("image_url"),
                },
                "quantity": i["quantity"],
                "selected_option_ids": i.get("selected_option_ids", []),
                "selected_options": i.get("selected_options", []),
            }
            for i in cart_dict.get("items", [])
        ]
        return CartResponse(
            restaurant_id=cart_dict.get("restaurant_id"),
            items=enriched,  # type: ignore[arg-type]
        )

    async def update_cart(self, identifier: str, cart_data: CartUpdate) -> None:
        await self._cache.set(self._key(identifier), cart_data.model_dump_json(), ttl=self._ttl)

    async def clear_cart(self, identifier: str) -> None:
        await self._cache.delete(self._key(identifier))


def get_cart_service(cache: CacheRepository = Depends(get_redis_cache)) -> CartService:
    return CartService(cache)
