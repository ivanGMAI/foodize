from abc import ABC, abstractmethod
from typing import Any


class MessagePublisher(ABC):
    @abstractmethod
    async def publish(self, routing_key: str, body: bytes | dict[str, Any]) -> None: ...
