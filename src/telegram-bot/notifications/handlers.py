import logging

import redis.asyncio as aioredis
from aiogram import Bot
from aiogram.exceptions import TelegramForbiddenError
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo

from config import bot_config
from utils.formatting import format_price, format_status

logger = logging.getLogger(__name__)


async def _get_telegram_id(user_id: str) -> int | None:
    client = aioredis.from_url(bot_config.redis_url, decode_responses=True)
    try:
        val = await client.get(f"user_tg:{user_id}")
        return int(val) if val else None
    finally:
        await client.aclose()


async def _deactivate_telegram_id(user_id: str) -> None:
    """Remove the Telegram binding when user has blocked the bot."""
    client = aioredis.from_url(bot_config.redis_url, decode_responses=True)
    try:
        await client.delete(f"user_tg:{user_id}")
        logger.info("Deactivated Telegram binding for user_id=%s (bot blocked)", user_id)
    finally:
        await client.aclose()


def _order_keyboard(order_display_id: str | None) -> InlineKeyboardMarkup | None:
    if not bot_config.mini_app_url:
        return None
    buttons = []
    if order_display_id:
        buttons.append(
            InlineKeyboardButton(
                text="Открыть заказ",
                web_app=WebAppInfo(
                    url=f"{bot_config.mini_app_url}?startapp=order_{order_display_id}"
                ),
            )
        )
    else:
        buttons.append(
            InlineKeyboardButton(
                text="Открыть Foodize",
                web_app=WebAppInfo(url=bot_config.mini_app_url),
            )
        )
    return InlineKeyboardMarkup(inline_keyboard=[buttons])


async def handle_order_placed(event: dict, bot: Bot) -> None:
    user_id = str(event.get("user_id", ""))
    telegram_id = await _get_telegram_id(user_id)
    if not telegram_id:
        return

    restaurant = event.get("restaurant_name", "")
    total = event.get("total_price", 0)
    count = event.get("items_count", 0)
    display_id = event.get("order_display_id")

    order_ref = f" <b>#{display_id}</b>" if display_id else ""
    text = (
        f"Заказ{order_ref} в <b>{restaurant}</b> принят!\n\n"
        f"Позиций: {count}\n"
        f"Сумма: {format_price(total)}\n\n"
        f"Мы уведомим вас, когда статус изменится."
    )
    try:
        await bot.send_message(
            chat_id=telegram_id,
            text=text,
            reply_markup=_order_keyboard(display_id),
        )
    except TelegramForbiddenError:
        logger.info("User %s blocked the bot, deactivating binding", user_id)
        await _deactivate_telegram_id(user_id)
    except Exception as e:
        logger.warning("Failed to send order_placed notification: %s", e)


async def handle_order_status_changed(event: dict, bot: Bot) -> None:
    user_id = str(event.get("user_id", ""))
    telegram_id = await _get_telegram_id(user_id)
    if not telegram_id:
        return

    new_status = event.get("new_status", "")
    restaurant = event.get("restaurant_name", "")
    total = event.get("total_price", 0)
    display_id = event.get("order_display_id")

    order_ref = f" <b>#{display_id}</b>" if display_id else ""
    text = (
        f"Обновление заказа{order_ref} в <b>{restaurant}</b>\n\n"
        f"Статус: <b>{format_status(new_status)}</b>\n"
        f"Сумма: {format_price(total)}"
    )
    try:
        await bot.send_message(
            chat_id=telegram_id,
            text=text,
            reply_markup=_order_keyboard(display_id),
        )
    except TelegramForbiddenError:
        logger.info("User %s blocked the bot, deactivating binding", user_id)
        await _deactivate_telegram_id(user_id)
    except Exception as e:
        logger.warning("Failed to send status_changed notification: %s", e)
