import json
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from aiogram.exceptions import TelegramForbiddenError
from aiogram.types import InlineKeyboardMarkup

from config import bot_config
from notifications.handlers import (
    _get_telegram_id,
    _deactivate_telegram_id,
    _order_keyboard,
    handle_order_placed,
    handle_order_status_changed,
)
from notifications.consumer import _process, start_notification_consumer


@pytest.mark.asyncio
async def test_get_telegram_id(mocker):
    mock_redis = mocker.patch("redis.asyncio.from_url")
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client

    mock_client.get.return_value = "12345"
    res = await _get_telegram_id("user_1")
    assert res == 12345
    mock_client.get.assert_called_with("user_tg:user_1")
    mock_client.aclose.assert_called_once()

    mock_client.get.return_value = None
    res = await _get_telegram_id("user_2")
    assert res is None


@pytest.mark.asyncio
async def test_deactivate_telegram_id(mocker):
    mock_redis = mocker.patch("redis.asyncio.from_url")
    mock_client = AsyncMock()
    mock_redis.return_value = mock_client

    await _deactivate_telegram_id("user_1")
    mock_client.delete.assert_called_with("user_tg:user_1")
    mock_client.aclose.assert_called_once()


def test_order_keyboard():
    bot_config.mini_app_url = ""
    assert _order_keyboard("123") is None

    bot_config.mini_app_url = "https://t.me/bot/app"

    kb = _order_keyboard("123")
    assert isinstance(kb, InlineKeyboardMarkup)
    assert kb.inline_keyboard[0][0].text == "Открыть заказ"
    assert kb.inline_keyboard[0][0].web_app.url == "https://t.me/bot/app?startapp=order_123"

    kb2 = _order_keyboard(None)
    assert isinstance(kb2, InlineKeyboardMarkup)
    assert kb2.inline_keyboard[0][0].text == "Открыть Foodize"
    assert kb2.inline_keyboard[0][0].web_app.url == "https://t.me/bot/app"


@pytest.mark.asyncio
async def test_handle_order_placed(mocker):
    mock_get_tg = mocker.patch("notifications.handlers._get_telegram_id")
    mock_deactivate = mocker.patch("notifications.handlers._deactivate_telegram_id")
    bot = AsyncMock()
    bot_config.mini_app_url = "https://t.me/bot/app"

    mock_get_tg.return_value = None
    event = {
        "user_id": "user_1",
        "restaurant_name": "Cafe",
        "total_price": 50000,
        "items_count": 3,
        "order_display_id": "999",
    }
    await handle_order_placed(event, bot)
    bot.send_message.assert_not_called()

    mock_get_tg.return_value = 12345
    await handle_order_placed(event, bot)
    bot.send_message.assert_called_once()
    args, kwargs = bot.send_message.call_args
    assert kwargs["chat_id"] == 12345
    assert "Cafe" in kwargs["text"]
    assert "500,00 ₽" in kwargs["text"]
    assert "999" in kwargs["text"]
    assert kwargs["reply_markup"] is not None

    bot.send_message.reset_mock()
    bot.send_message.side_effect = TelegramForbiddenError(method=MagicMock(), message="Bot blocked")
    await handle_order_placed(event, bot)
    mock_deactivate.assert_called_once_with("user_1")

    bot.send_message.reset_mock()
    bot.send_message.side_effect = Exception("Network error")
    await handle_order_placed(event, bot)


@pytest.mark.asyncio
async def test_handle_order_status_changed(mocker):
    mock_get_tg = mocker.patch("notifications.handlers._get_telegram_id")
    mock_deactivate = mocker.patch("notifications.handlers._deactivate_telegram_id")
    bot = AsyncMock()
    bot_config.mini_app_url = "https://t.me/bot/app"

    mock_get_tg.return_value = None
    event = {
        "user_id": "user_1",
        "new_status": "READY",
        "restaurant_name": "Cafe",
        "total_price": 50000,
        "order_display_id": "999",
    }
    await handle_order_status_changed(event, bot)
    bot.send_message.assert_not_called()

    mock_get_tg.return_value = 12345
    await handle_order_status_changed(event, bot)
    bot.send_message.assert_called_once()
    args, kwargs = bot.send_message.call_args
    assert kwargs["chat_id"] == 12345
    assert "Caf" in kwargs["text"]
    assert "Готов к выдаче" in kwargs["text"]

    bot.send_message.reset_mock()
    bot.send_message.side_effect = TelegramForbiddenError(method=MagicMock(), message="Bot blocked")
    await handle_order_status_changed(event, bot)
    mock_deactivate.assert_called_once_with("user_1")

    bot.send_message.reset_mock()
    bot.send_message.side_effect = Exception("Network error")
    await handle_order_status_changed(event, bot)


@pytest.mark.asyncio
async def test_process_notification_success():
    message = AsyncMock()
    message.body = json.dumps({"test": "data"}).encode("utf-8")
    handler = AsyncMock()
    bot = AsyncMock()
    exchange = AsyncMock()

    await _process(message, handler, bot, exchange, "test_rk")
    handler.assert_called_once_with({"test": "data"}, bot)
    message.ack.assert_called_once()


@pytest.mark.asyncio
async def test_process_notification_retry(mocker):
    message = AsyncMock()
    message.body = json.dumps({"test": "data"}).encode("utf-8")
    message.headers = {"x-retry-count": 1}
    message.delivery_mode = 2

    handler = AsyncMock(side_effect=Exception("Failed"))
    bot = AsyncMock()
    exchange = AsyncMock()

    await _process(message, handler, bot, exchange, "test_rk")
    message.ack.assert_called_once()
    exchange.publish.assert_called_once()
    published_msg = exchange.publish.call_args[0][0]
    assert published_msg.headers["x-retry-count"] == 2


@pytest.mark.asyncio
async def test_process_notification_dlq(mocker):
    message = AsyncMock()
    message.body = json.dumps({"test": "data"}).encode("utf-8")
    message.headers = {"x-retry-count": 3}
    message.delivery_mode = 2

    handler = AsyncMock(side_effect=Exception("Failed"))
    bot = AsyncMock()
    exchange = AsyncMock()

    await _process(message, handler, bot, exchange, "test_rk")
    message.reject.assert_called_once_with(requeue=False)
    exchange.publish.assert_not_called()


@pytest.mark.asyncio
async def test_start_notification_consumer(mocker):
    mock_connect = mocker.patch("aio_pika.connect_robust")
    mock_conn = AsyncMock()
    mock_channel = AsyncMock()
    mock_queue = AsyncMock()

    mock_connect.return_value = mock_conn
    mock_conn.channel.return_value = mock_channel
    mock_channel.declare_queue.return_value = mock_queue

    bot = AsyncMock()

    with patch("asyncio.Future", side_effect=asyncio.CancelledError):
        with pytest.raises(asyncio.CancelledError):
            await start_notification_consumer(bot)

    mock_connect.assert_called_once_with(bot_config.rabbitmq_url)
    mock_channel.set_qos.assert_called_once_with(prefetch_count=10)
    mock_channel.declare_exchange.assert_any_call("foodize.events", "topic", durable=True)
    mock_channel.declare_exchange.assert_any_call("foodize.dlx", "topic", durable=True)
    assert mock_queue.bind.called
    assert mock_queue.consume.called
