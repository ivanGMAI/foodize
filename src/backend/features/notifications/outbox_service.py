import asyncio
import logging
from datetime import datetime, timedelta, timezone

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database.db_helper import db_helper
from features.notifications.outbox import OutboxEvent
from infra.messaging.base import MessagePublisher
from infra.messaging.rabbitmq import get_rabbitmq_publisher
from shared.enums.event_type import EventType
from shared.enums.outbox_status import OutboxStatus

logger = logging.getLogger(__name__)

_ROUTING = {
    EventType.ORDER_PLACED.value: EventType.ORDER_PLACED.value,
    EventType.ORDER_STATUS_CHANGED.value: EventType.ORDER_STATUS_CHANGED.value,
}


async def enqueue_event(session: AsyncSession, event: BaseModel) -> OutboxEvent:
    event_type = str(getattr(event, "event_type"))
    outbox_event = OutboxEvent(
        event_id=getattr(event, "event_id"),
        event_type=event_type,
        routing_key=_ROUTING.get(event_type, event_type),
        payload=event.model_dump(mode="json"),
    )
    session.add(outbox_event)
    return outbox_event


async def publish_pending_events(
    session: AsyncSession,
    publisher: MessagePublisher | None = None,
    limit: int = 50,
) -> int:
    if publisher is None:
        publisher = get_rabbitmq_publisher()

    now = datetime.now(timezone.utc)
    result = await session.execute(
        select(OutboxEvent)
        .where(OutboxEvent.status == OutboxStatus.PENDING.value)
        .where(OutboxEvent.next_attempt_at <= now)
        .order_by(OutboxEvent.created_at)
        .limit(limit)
    )
    events = list(result.scalars().all())

    published = 0
    for event in events:
        try:
            await publisher.publish(event.routing_key, event.payload)
        except Exception as exc:
            event.attempts += 1
            event.last_error = str(exc)
            delay_seconds = min(300, 2 ** min(event.attempts, 8))
            event.next_attempt_at = now + timedelta(seconds=delay_seconds)
            logger.exception("Outbox publish failed event_id=%s", event.event_id)
        else:
            event.status = OutboxStatus.PUBLISHED.value
            event.published_at = datetime.now(timezone.utc)
            event.last_error = None
            published += 1

    if events:
        await session.commit()
    return published


async def run_outbox_publisher(poll_interval: float = 5.0) -> None:
    logger.info("Outbox publisher started")
    while True:
        try:
            async with db_helper.session_factory() as session:
                await publish_pending_events(session)
        except Exception:
            logger.exception("Outbox publisher tick failed")
        await asyncio.sleep(poll_interval)
