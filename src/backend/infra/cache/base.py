from abc import ABC, abstractmethod


class CacheRepository(ABC):
    @abstractmethod
    async def get(self, key: str) -> str | None: ...

    @abstractmethod
    async def set(self, key: str, value: str, ttl: int | None = None) -> None: ...

    @abstractmethod
    async def delete(self, key: str) -> None: ...

    @abstractmethod
    async def exists(self, key: str) -> bool: ...

    @abstractmethod
    async def set_nx(self, key: str, value: str, ttl: int | None = None) -> bool: ...

    @abstractmethod
    async def sadd(self, key: str, *values: str) -> None: ...

    @abstractmethod
    async def smembers(self, key: str): ...

    @abstractmethod
    async def delete_many(self, *keys: str) -> None: ...
