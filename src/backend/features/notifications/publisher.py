import logging

from features.notifications.events import OrderPlacedEvent, OrderStatusChangedEvent
from infra.messaging.base import MessagePublisher
from infra.messaging.rabbitmq import get_rabbitmq_publisher

logger = logging.getLogger(__name__)

_ROUTING = {
    "order.placed": "order.placed",
    "order.status_changed": "order.status_changed",
}


async def _publish(
    event: OrderPlacedEvent | OrderStatusChangedEvent,
    publisher: MessagePublisher | None = None,
) -> None:
    if publisher is None:
        publisher = get_rabbitmq_publisher()
    routing_key = _ROUTING.get(event.event_type, event.event_type)
    await publisher.publish(routing_key, event.model_dump(mode="json"))


async def publish_order_placed(event: OrderPlacedEvent) -> None:
    await _publish(event)


async def publish_order_status_changed(event: OrderStatusChangedEvent) -> None:
    await _publish(event)
