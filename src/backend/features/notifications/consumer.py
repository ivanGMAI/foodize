import asyncio
import logging
from collections.abc import Awaitable, Callable
from functools import partial
from typing import Any

import aio_pika
import aio_pika.abc
from pydantic import BaseModel

from features.notifications.broker import broker
from features.notifications.events import OrderPlacedEvent, OrderStatusChangedEvent
from features.notifications.handlers import (
    handle_order_placed,
    handle_order_status_changed,
)
from features.notifications.outbox_service import run_outbox_publisher

logger = logging.getLogger(__name__)

_BINDINGS: list[tuple[str, str, Callable[[Any], Awaitable[None]]]] = [
    ("notifications.order.placed", "order.placed", handle_order_placed),
    (
        "notifications.order.status_changed",
        "order.status_changed",
        handle_order_status_changed,
    ),
]

_EVENT_MODELS: dict[str, type[BaseModel]] = {
    "order.placed": OrderPlacedEvent,
    "order.status_changed": OrderStatusChangedEvent,
}


async def _process_message(
    message: aio_pika.abc.AbstractIncomingMessage,
    routing_key: str,
) -> None:
    async with message.process(requeue=False):
        try:
            model_cls = _EVENT_MODELS[routing_key]
            event = model_cls.model_validate_json(message.body)
            _, _, handler = next(b for b in _BINDINGS if b[1] == routing_key)
            await handler(event)
        except Exception:
            logger.exception("Failed to process message (routing_key=%s)", routing_key)


async def start_consuming() -> None:
    await broker.connect()
    asyncio.create_task(run_outbox_publisher())
    exchange = broker.exchange
    channel = broker.channel

    for queue_name, routing_key, _ in _BINDINGS:
        queue = await channel.declare_queue(queue_name, durable=True)
        await queue.bind(exchange, routing_key=routing_key)
        await queue.consume(partial(_process_message, routing_key=routing_key))
        logger.info("Consuming queue=%s routing_key=%s", queue_name, routing_key)

    logger.info("Worker started. Waiting for messages...")
    await asyncio.Future()


async def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    try:
        await start_consuming()
    finally:
        await broker.disconnect()
