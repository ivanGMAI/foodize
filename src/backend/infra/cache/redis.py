import redis.asyncio as aioredis
from redis.asyncio import Redis

from infra.cache.base import CacheRepository
from settings.config.app_config import settings

_pool = aioredis.ConnectionPool.from_url(settings.redis.url, decode_responses=True)


def _get_client() -> Redis:
    return aioredis.Redis(connection_pool=_pool)


class RedisCache(CacheRepository):
    def __init__(self, client: Redis) -> None:
        self._client = client

    async def get(self, key: str) -> str | None:
        return await self._client.get(key)

    async def set(self, key: str, value: str, ttl: int | None = None) -> None:
        await self._client.set(key, value, ex=ttl)

    async def delete(self, key: str) -> None:
        await self._client.delete(key)

    async def exists(self, key: str) -> bool:
        return bool(await self._client.exists(key))  # type: ignore[misc]

    async def set_nx(self, key: str, value: str, ttl: int | None = None) -> bool:
        return bool(await self._client.set(key, value, ex=ttl, nx=True))

    async def sadd(self, key: str, *values: str) -> None:
        await self._client.sadd(key, *values)  # type: ignore[misc]

    async def smembers(self, key: str):
        result = await self._client.smembers(key)  # type: ignore[misc]
        return set(result)

    async def delete_many(self, *keys: str) -> None:
        if keys:
            await self._client.delete(*keys)

    async def publish(self, channel: str, message: str) -> None:
        await self._client.publish(channel, message)

    def get_raw_client(self) -> Redis:
        return self._client


def get_redis_cache() -> RedisCache:
    return RedisCache(_get_client())


async def close_redis_pool() -> None:
    await _pool.aclose()
