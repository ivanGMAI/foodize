from unittest.mock import AsyncMock

import pytest

from infra.cache.redis import RedisCache


class TestRedisCache:
    @pytest.mark.asyncio
    async def test_get(self):
        client = AsyncMock()
        client.get = AsyncMock(return_value="value")
        cache = RedisCache(client)
        result = await cache.get("key")
        assert result == "value"

    @pytest.mark.asyncio
    async def test_set_with_ttl(self):
        client = AsyncMock()
        client.set = AsyncMock()
        cache = RedisCache(client)
        await cache.set("key", "value", ttl=60)
        client.set.assert_awaited_once_with("key", "value", ex=60)

    @pytest.mark.asyncio
    async def test_set_without_ttl(self):
        client = AsyncMock()
        client.set = AsyncMock()
        cache = RedisCache(client)
        await cache.set("key", "value")
        client.set.assert_awaited_once_with("key", "value", ex=None)

    @pytest.mark.asyncio
    async def test_delete(self):
        client = AsyncMock()
        client.delete = AsyncMock()
        cache = RedisCache(client)
        await cache.delete("key")
        client.delete.assert_awaited_once_with("key")

    @pytest.mark.asyncio
    async def test_exists_true(self):
        client = AsyncMock()
        client.exists = AsyncMock(return_value=1)
        cache = RedisCache(client)
        result = await cache.exists("key")
        assert result is True

    @pytest.mark.asyncio
    async def test_exists_false(self):
        client = AsyncMock()
        client.exists = AsyncMock(return_value=0)
        cache = RedisCache(client)
        result = await cache.exists("key")
        assert result is False
