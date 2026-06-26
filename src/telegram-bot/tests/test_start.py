import pytest
import httpx
from unittest.mock import AsyncMock, MagicMock
from aiogram.types import ReplyKeyboardMarkup, InlineKeyboardMarkup
from config import bot_config
from handlers.start import (
    _mini_app_keyboard,
    _restaurant_keyboard,
    _order_deep_link_keyboard,
    _orders_keyboard,
    _phone_keyboard,
    _normalize_phone,
    _display_name,
    _link_phone,
    _vendor_status_text,
    cmd_vendor_status,
    cmd_orders,
    cmd_start,
    handle_restart_button,
    handle_contact,
    handle_phone_text,
)


def test_mini_app_keyboard():
    bot_config.mini_app_url = ""
    assert _mini_app_keyboard() is None
    bot_config.mini_app_url = "https://app.url"
    kb = _mini_app_keyboard()
    assert isinstance(kb, InlineKeyboardMarkup)


def test_restaurant_keyboard():
    bot_config.mini_app_url = ""
    assert _restaurant_keyboard("123", "Rest") is None
    bot_config.mini_app_url = "https://app.url"
    kb = _restaurant_keyboard("123", "Rest")
    assert isinstance(kb, InlineKeyboardMarkup)


def test_order_deep_link_keyboard():
    bot_config.mini_app_url = ""
    assert _order_deep_link_keyboard("123") is None
    bot_config.mini_app_url = "https://app.url"
    kb = _order_deep_link_keyboard("123")
    assert isinstance(kb, InlineKeyboardMarkup)


def test_orders_keyboard():
    bot_config.mini_app_url = ""
    assert _orders_keyboard([{"display_id": "123"}]) is None
    bot_config.mini_app_url = "https://app.url"
    kb = _orders_keyboard([{"display_id": "123"}])
    assert isinstance(kb, InlineKeyboardMarkup)
    assert _orders_keyboard([]) is None
    assert _orders_keyboard([{}]) is None


def test_phone_keyboard():
    kb = _phone_keyboard()
    assert isinstance(kb, ReplyKeyboardMarkup)


def test_normalize_phone():
    assert _normalize_phone("89990000000") == "+79990000000"
    assert _normalize_phone("+79990000000") == "+79990000000"
    assert _normalize_phone("  +7-999-000-00-00  ") == "+79990000000"


def test_display_name():
    m = MagicMock()
    m.from_user = None
    assert _display_name(m) == "Telegram User"

    u = MagicMock()
    u.full_name = "Full Name"
    m.from_user = u
    assert _display_name(m) == "Full Name"

    u.full_name = ""
    u.username = "user"
    assert _display_name(m) == "user"

    u.username = ""
    u.id = 123
    assert _display_name(m) == "Telegram 123"


def test_vendor_status_text():
    assert "профиль не найден" in _vendor_status_text({"is_vendor": False})
    assert "одобрена" in _vendor_status_text({"is_vendor": True, "approval_status": "APPROVED"})
    assert "отклонена" in _vendor_status_text({"is_vendor": True, "approval_status": "REJECTED"})
    assert "Причина: test" in _vendor_status_text(
        {"is_vendor": True, "approval_status": "REJECTED", "rejection_reason": "test"}
    )
    assert "рассмотрении" in _vendor_status_text({"is_vendor": True, "approval_status": "PENDING"})


@pytest.mark.asyncio
async def test_link_phone_failure_no_secret():
    m = AsyncMock()
    m.from_user = MagicMock()
    bot_config.bot_api_secret = ""
    res = await _link_phone(m, "+79990000000")
    assert res is False
    m.answer.assert_called_with(
        "Бот пока не настроен для регистрации: не задан TELEGRAM__BOT_API_SECRET."
    )


@pytest.mark.asyncio
async def test_link_phone_http_status_errors(mocker):
    m = AsyncMock()
    m.from_user = MagicMock()
    bot_config.bot_api_secret = "secret"
    bot_config.backend_url = "http://backend"

    mock_post = mocker.patch("httpx.AsyncClient.post")

    req = httpx.Request("POST", "http://backend/api/v1/telegram/bot/link-phone")
    resp_403 = httpx.Response(403, request=req)
    mock_post.side_effect = httpx.HTTPStatusError("Forbidden", request=req, response=resp_403)
    res = await _link_phone(m, "+79990000000")
    assert res is False
    m.answer.assert_called_with("Бот не прошел проверку доступа к Foodize API.")

    resp_500 = httpx.Response(500, request=req)
    mock_post.side_effect = httpx.HTTPStatusError("Server Error", request=req, response=resp_500)
    res = await _link_phone(m, "+79990000000")
    assert res is False
    m.answer.assert_called_with(
        "Не получилось привязать телефон. Проверьте номер и попробуйте еще раз."
    )

    mock_post.side_effect = httpx.HTTPError("Conn Error")
    res = await _link_phone(m, "+79990000000")
    assert res is False
    m.answer.assert_called_with("Foodize API сейчас недоступен. Попробуйте чуть позже.")


@pytest.mark.asyncio
async def test_link_phone_success(mocker):
    m = AsyncMock()
    m.from_user = MagicMock()
    bot_config.bot_api_secret = "secret"
    bot_config.backend_url = "http://backend"
    bot_config.mini_app_url = "https://t.me/app"

    mock_post = mocker.patch("httpx.AsyncClient.post")
    req = httpx.Request("POST", "http://backend/api/v1/telegram/bot/link-phone")
    mock_post.return_value = httpx.Response(200, request=req)

    res = await _link_phone(m, "+79990000000")
    assert res is True
    assert m.answer.call_count == 2


@pytest.mark.asyncio
async def test_cmd_vendor_status(mocker):
    m = AsyncMock()
    m.from_user = None
    await cmd_vendor_status(m)

    m.from_user = MagicMock()
    bot_config.bot_api_secret = ""
    await cmd_vendor_status(m)
    m.answer.assert_called_with("Проверка статуса вендора пока не настроена.")

    bot_config.bot_api_secret = "secret"
    mock_post = mocker.patch("httpx.AsyncClient.post")

    req = httpx.Request("POST", "http://backend/api/v1/telegram/bot/vendor-status")
    resp_403 = httpx.Response(403, request=req)
    mock_post.side_effect = httpx.HTTPStatusError("Forbidden", request=req, response=resp_403)
    await cmd_vendor_status(m)
    m.answer.assert_called_with("Бот не прошел проверку доступа к Foodize API.")

    resp_500 = httpx.Response(500, request=req)
    mock_post.side_effect = httpx.HTTPStatusError("Server Error", request=req, response=resp_500)
    await cmd_vendor_status(m)
    m.answer.assert_called_with("Не удалось получить статус. Попробуйте позже.")

    mock_post.side_effect = httpx.HTTPError("Conn Error")
    await cmd_vendor_status(m)
    m.answer.assert_called_with("Foodize API сейчас недоступен. Попробуйте чуть позже.")

    mock_post.side_effect = None
    mock_post.return_value = httpx.Response(
        200, request=req, json={"data": {"is_vendor": True, "approval_status": "APPROVED"}}
    )
    await cmd_vendor_status(m)
    assert "одобрена" in m.answer.call_args[0][0]


@pytest.mark.asyncio
async def test_cmd_orders(mocker):
    m = AsyncMock()
    m.from_user = None
    await cmd_orders(m)

    m.from_user = MagicMock()
    bot_config.bot_api_secret = ""
    await cmd_orders(m)
    m.answer.assert_called_with("Просмотр заказов пока не настроен.")

    bot_config.bot_api_secret = "secret"
    mock_post = mocker.patch("httpx.AsyncClient.post")

    req = httpx.Request("POST", "http://backend/api/v1/telegram/bot/orders")
    resp_403 = httpx.Response(403, request=req)
    mock_post.side_effect = httpx.HTTPStatusError("Forbidden", request=req, response=resp_403)
    await cmd_orders(m)
    m.answer.assert_called_with("Бот не прошел проверку доступа к Foodize API.")

    resp_500 = httpx.Response(500, request=req)
    mock_post.side_effect = httpx.HTTPStatusError("Server Error", request=req, response=resp_500)
    await cmd_orders(m)
    m.answer.assert_called_with("Не удалось получить заказы. Попробуйте позже.")

    mock_post.side_effect = httpx.HTTPError("Conn error")
    await cmd_orders(m)
    m.answer.assert_called_with("Foodize API сейчас недоступен. Попробуйте чуть позже.")

    mock_post.side_effect = None
    mock_post.return_value = httpx.Response(200, request=req, json={"data": []})
    await cmd_orders(m)
    m.answer.assert_called_with("Активных заказов сейчас нет.")

    mock_post.return_value = httpx.Response(
        200,
        request=req,
        json={
            "data": [
                {
                    "display_id": "123",
                    "restaurant_name": "Cafe",
                    "status": "COOKING",
                    "total_price": 1000,
                }
            ]
        },
    )
    await cmd_orders(m)
    assert "Ваши активные заказы" in m.answer.call_args[0][0]


@pytest.mark.asyncio
async def test_cmd_start_deep_link_restaurant(mocker):
    m = AsyncMock()
    m.text = "/start restaurant_123"

    bot_config.backend_url = "http://backend"
    bot_config.mini_app_url = "https://t.me/app"

    mock_get = mocker.patch("httpx.AsyncClient.get")
    req = httpx.Request("GET", "http://backend/api/v1/restaurants/public/123")
    mock_get.return_value = httpx.Response(
        200, request=req, json={"data": {"name": "Cafe Delicious"}}
    )

    await cmd_start(m)
    m.answer.assert_called_once()
    assert "Cafe Delicious" in m.answer.call_args[0][0]

    m.answer.reset_mock()
    mock_get.side_effect = Exception("Err")
    await cmd_start(m)
    m.answer.assert_called_once()


@pytest.mark.asyncio
async def test_cmd_start_deep_link_order(mocker):
    m = AsyncMock()
    m.text = "/start order_456"
    bot_config.mini_app_url = "https://t.me/app"
    await cmd_start(m)
    m.answer.assert_called_once()
    assert "456" in m.answer.call_args[0][0]


@pytest.mark.asyncio
async def test_cmd_start_default():
    m = AsyncMock()
    m.text = "/start"
    bot_config.mini_app_url = "https://t.me/app"
    await cmd_start(m)
    assert m.answer.call_count == 2


@pytest.mark.asyncio
async def test_handle_restart_button(mocker):
    mock_cmd_start = mocker.patch("handlers.start.cmd_start")
    m = AsyncMock()
    await handle_restart_button(m)
    mock_cmd_start.assert_called_once_with(m)


@pytest.mark.asyncio
async def test_handle_contact(mocker):
    m = AsyncMock()
    m.contact = None
    await handle_contact(m)

    m.contact = MagicMock()
    m.from_user = MagicMock()
    m.contact.user_id = 999
    m.from_user.id = 888
    await handle_contact(m)
    m.answer.assert_called_with("Пожалуйста, отправьте свой номер телефона.")

    m.contact.user_id = 888
    m.contact.phone_number = "+79990000000"
    mock_link = mocker.patch("handlers.start._link_phone")
    await handle_contact(m)
    mock_link.assert_called_once()


@pytest.mark.asyncio
async def test_handle_phone_text(mocker):
    m = AsyncMock()
    m.text = ""
    await handle_phone_text(m)

    m.text = "+79990000000"
    mock_link = mocker.patch("handlers.start._link_phone")
    await handle_phone_text(m)
    mock_link.assert_called_once()
