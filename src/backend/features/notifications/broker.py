import logging

import aio_pika
import aio_pika.abc

from settings.config.app_config import settings

logger = logging.getLogger(__name__)

EXCHANGE_NAME = "foodize.events"
EXCHANGE_TYPE = aio_pika.ExchangeType.TOPIC


class RabbitMQBroker:
    def __init__(self, url: str) -> None:
        self._url = url
        self._connection: aio_pika.abc.AbstractRobustConnection | None = None
        self._channel: aio_pika.abc.AbstractChannel | None = None
        self._exchange: aio_pika.abc.AbstractExchange | None = None

    async def connect(self) -> None:
        self._connection = await aio_pika.connect_robust(self._url)
        self._channel = await self._connection.channel()
        await self._channel.set_qos(prefetch_count=10)
        self._exchange = await self._channel.declare_exchange(
            EXCHANGE_NAME,
            EXCHANGE_TYPE,
            durable=True,
        )
        logger.info("RabbitMQ connected: %s", self._url)

    async def disconnect(self) -> None:
        if self._connection and not self._connection.is_closed:
            await self._connection.close()
        logger.info("RabbitMQ disconnected")

    @property
    def exchange(self) -> aio_pika.abc.AbstractExchange:
        if self._exchange is None:
            raise RuntimeError("RabbitMQ broker is not connected. Call connect() first.")
        return self._exchange

    @property
    def channel(self) -> aio_pika.abc.AbstractChannel:
        if self._channel is None:
            raise RuntimeError("RabbitMQ broker is not connected. Call connect() first.")
        return self._channel


broker = RabbitMQBroker(url=str(settings.rabbitmq.url))
