"""Customer order agent: system prompt + agent orchestration.

Opens its own DB session inside the agent loop so it survives the streamed
response. Tools are scoped to the current user; structured tool-call schemas
(function calling) are the structured-output contract between model and app.
"""

import logging
from collections.abc import AsyncIterator, Iterable

from database import db_helper
from features.ai_order_agent.schemas import OrderChatMessageIn
from features.ai_order_agent.tools import ORDER_TOOLS, build_order_executor
from features.cart.service import CartService
from features.users.models import User
from infra.cache.redis import get_redis_cache
from infra.llm import AgentRole, Message, Role, get_llm_client, stream_agent
from settings.config.app_config import settings

logger = logging.getLogger("ai.order")

SYSTEM_PROMPT = (
    "Ты — помощник по заказу еды в сервисе предзаказа QUICK. Помогаешь найти блюда и "
    "оформить заказ, общаясь на русском, кратко и дружелюбно.\n"
    "Инструменты: search_menu (поиск по меню), add_to_cart / remove_from_cart / "
    "clear_cart / view_cart (корзина), place_order (оформление).\n"
    "Правила:\n"
    "1) Не выдумывай блюда, цены и наличие — бери их только из инструментов.\n"
    "2) Показывай найденные варианты с ценой и названием ресторана; при неоднозначности "
    "уточняй у пользователя, какую именно позицию добавить.\n"
    "3) Если search_menu вернул пустой список (results пуст или есть message о том, что "
    "ничего нет) — НЕ повторяй поиск с другими словами. Сразу честно сообщи, что сейчас "
    "нет доступных ресторанов или блюд, и предложи зайти позже.\n"
    "4) Корзина может содержать позиции только одного ресторана. Если инструмент вернул "
    "ошибку cart_has_other_restaurant — объясни это и предложи очистить корзину.\n"
    "5) ОБЯЗАТЕЛЬНО: перед вызовом place_order сначала покажи состав корзины и сумму "
    "(view_cart) и дождись явного подтверждения пользователя (например «да», «оформляй»). "
    "Никогда не вызывай place_order в том же ответе, где пользователь впервые попросил "
    "заказать, — только после его явного подтверждения в последнем сообщении.\n"
    "6) После успешного оформления сообщи номер заказа и сумму."
)


def _to_messages(items: Iterable[OrderChatMessageIn]) -> list[Message]:
    return [Message(role=Role(item.role), content=item.content) for item in items]


async def stream_chat(
    user: User,
    history: Iterable[OrderChatMessageIn],
) -> AsyncIterator[str]:
    client = get_llm_client(AgentRole.ORDER)
    cart_service = CartService(get_redis_cache())
    try:
        async with db_helper.session_factory() as session:
            execute = build_order_executor(session, user, cart_service)
            async for chunk in stream_agent(
                client,
                system=SYSTEM_PROMPT,
                messages=_to_messages(history),
                tools=ORDER_TOOLS,
                execute=execute,
                max_steps=settings.llm.max_agent_steps,
            ):
                yield chunk
    except Exception:
        logger.exception("order chat stream failed")
        yield "\n\nИзвините, произошла ошибка. Попробуйте ещё раз."
