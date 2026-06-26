import json
import logging
from typing import Any

import aio_pika

from features.notifications.broker import broker
from infra.messaging.base import MessagePublisher

logger = logging.getLogger(__name__)


class RabbitMQPublisher(MessagePublisher):
    def __init__(self, broker) -> None:
        self._broker = broker

    async def publish(self, routing_key: str, body: bytes | dict[str, Any]) -> None:
        if isinstance(body, dict):
            body = json.dumps(body).encode()
        message = aio_pika.Message(
            body=body,
            content_type="application/json",
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        try:
            await self._broker.exchange.publish(message, routing_key=routing_key)
            logger.debug("Published message routing_key=%s", routing_key)
        except Exception:
            logger.exception("Failed to publish message routing_key=%s", routing_key)
            raise


def get_rabbitmq_publisher() -> RabbitMQPublisher:
    return RabbitMQPublisher(broker)
