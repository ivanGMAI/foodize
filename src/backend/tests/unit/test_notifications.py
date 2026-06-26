import logging
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.notifications.consumer import _process_message
from features.notifications.events import OrderPlacedEvent, OrderStatusChangedEvent
from features.notifications.handlers import (
    handle_order_placed,
    handle_order_status_changed,
)
from features.notifications.outbox_service import enqueue_event, publish_pending_events
from features.notifications.publisher import (
    publish_order_placed,
    publish_order_status_changed,
)
from shared.enums.order_status import OrderStatus
from shared.enums.outbox_status import OutboxStatus


def _make_placed_event() -> OrderPlacedEvent:
    return OrderPlacedEvent(
        order_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        restaurant_id=uuid.uuid4(),
        restaurant_name="Test Cafe",
        total_price=1500,
        items_count=3,
    )


def _make_status_event() -> OrderStatusChangedEvent:
    return OrderStatusChangedEvent(
        order_id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        restaurant_id=uuid.uuid4(),
        restaurant_name="Test Cafe",
        old_status=OrderStatus.PENDING,
        new_status=OrderStatus.ACCEPTED,
        total_price=1500,
    )


class TestHandlers:
    @pytest.mark.asyncio
    async def test_handle_order_placed_logs(self, caplog):
        event = _make_placed_event()
        with (
            caplog.at_level(logging.INFO, logger="features.notifications.handlers"),
            patch("features.notifications.handlers._notify_user", new_callable=AsyncMock),
        ):
            await handle_order_placed(event)
        assert "order.placed" in caplog.text

    @pytest.mark.asyncio
    async def test_handle_order_status_changed_logs(self, caplog):
        event = _make_status_event()
        with (
            caplog.at_level(logging.INFO, logger="features.notifications.handlers"),
            patch("features.notifications.handlers._notify_user", new_callable=AsyncMock),
        ):
            await handle_order_status_changed(event)
        assert "order.status_changed" in caplog.text


class TestPublisher:
    @pytest.mark.asyncio
    async def test_publish_order_placed_calls_publish(self):
        event = _make_placed_event()
        mock_publisher = AsyncMock()

        with patch(
            "features.notifications.publisher.get_rabbitmq_publisher",
            return_value=mock_publisher,
        ):
            await publish_order_placed(event)

        mock_publisher.publish.assert_awaited_once()
        call_args = mock_publisher.publish.call_args
        assert call_args[0][0] == "order.placed"

    @pytest.mark.asyncio
    async def test_publish_order_status_changed_calls_publish(self):
        event = _make_status_event()
        mock_publisher = AsyncMock()

        with patch(
            "features.notifications.publisher.get_rabbitmq_publisher",
            return_value=mock_publisher,
        ):
            await publish_order_status_changed(event)

        mock_publisher.publish.assert_awaited_once()
        call_args = mock_publisher.publish.call_args
        assert call_args[0][0] == "order.status_changed"


class TestConsumer:
    @pytest.mark.asyncio
    async def test_process_message_valid_order_placed(self, caplog):
        event = _make_placed_event()
        message = MagicMock()
        message.body = event.model_dump_json().encode()
        message.process = MagicMock(
            return_value=MagicMock(__aenter__=AsyncMock(), __aexit__=AsyncMock())
        )

        with (
            caplog.at_level(logging.INFO, logger="features.notifications.handlers"),
            patch("features.notifications.handlers._notify_user", new_callable=AsyncMock),
        ):
            await _process_message(message, "order.placed")
        assert "order.placed" in caplog.text

    @pytest.mark.asyncio
    async def test_process_message_valid_order_status_changed(self, caplog):
        event = _make_status_event()
        message = MagicMock()
        message.body = event.model_dump_json().encode()
        message.process = MagicMock(
            return_value=MagicMock(__aenter__=AsyncMock(), __aexit__=AsyncMock())
        )

        with (
            caplog.at_level(logging.INFO, logger="features.notifications.handlers"),
            patch("features.notifications.handlers._notify_user", new_callable=AsyncMock),
        ):
            await _process_message(message, "order.status_changed")
        assert "order.status_changed" in caplog.text

    @pytest.mark.asyncio
    async def test_process_message_unknown_routing_key_no_crash(self):
        message = MagicMock()
        message.body = b"{}"
        message.process = MagicMock(
            return_value=MagicMock(__aenter__=AsyncMock(), __aexit__=AsyncMock())
        )

        await _process_message(message, "unknown.routing.key")

    @pytest.mark.asyncio
    async def test_process_message_handler_raises_no_crash(self):
        event = _make_placed_event()
        message = MagicMock()
        message.body = event.model_dump_json().encode()
        message.process = MagicMock(
            return_value=MagicMock(__aenter__=AsyncMock(), __aexit__=AsyncMock())
        )

        with patch(
            "features.notifications.consumer.handle_order_placed",
            new_callable=AsyncMock,
            side_effect=RuntimeError("fail"),
        ):
            await _process_message(message, "order.placed")


class TestOutboxService:
    @pytest.mark.asyncio
    async def test_enqueue_event_adds_outbox_record(self):
        session = MagicMock()
        event = _make_placed_event()

        outbox = await enqueue_event(session, event)

        assert outbox.event_id == event.event_id
        assert outbox.event_type == "order.placed"
        assert outbox.routing_key == "order.placed"
        assert outbox.payload["order_id"] == str(event.order_id)
        session.add.assert_called_once_with(outbox)

    @pytest.mark.asyncio
    async def test_publish_pending_events_marks_successful_events_published(self):
        event = MagicMock()
        event.routing_key = "order.placed"
        event.payload = {"order_id": "1"}
        event.status = OutboxStatus.PENDING.value
        event.event_id = uuid.uuid4()
        event.last_error = "old error"

        result = MagicMock()
        result.scalars.return_value.all.return_value = [event]
        session = AsyncMock()
        session.execute = AsyncMock(return_value=result)
        publisher = AsyncMock()

        published = await publish_pending_events(session, publisher=publisher)

        assert published == 1
        publisher.publish.assert_awaited_once_with("order.placed", {"order_id": "1"})
        assert event.status == OutboxStatus.PUBLISHED.value
        assert event.published_at is not None
        assert event.last_error is None
        session.commit.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_publish_pending_events_records_failure_and_backoff(self):
        event = MagicMock()
        event.routing_key = "order.placed"
        event.payload = {"order_id": "1"}
        event.status = OutboxStatus.PENDING.value
        event.event_id = uuid.uuid4()
        event.attempts = 0
        event.next_attempt_at = None

        result = MagicMock()
        result.scalars.return_value.all.return_value = [event]
        session = AsyncMock()
        session.execute = AsyncMock(return_value=result)
        publisher = AsyncMock()
        publisher.publish.side_effect = RuntimeError("broker down")

        published = await publish_pending_events(session, publisher=publisher)

        assert published == 0
        assert event.attempts == 1
        assert event.last_error == "broker down"
        assert event.next_attempt_at is not None
        assert event.status == OutboxStatus.PENDING.value
        session.commit.assert_awaited_once()
