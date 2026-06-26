"""Vendor AI advisor: system prompt + agent orchestration.

Each call opens its own DB session inside the agent loop so the session stays
alive for the whole streamed response (FastAPI tears down request-scoped
dependencies before a StreamingResponse finishes). The vendor object is only
read for its ``id``, so passing it detached is safe.
"""

import logging
import uuid
from collections.abc import AsyncIterator, Iterable

from database import db_helper
from features.ai_advisor.schemas import ChatMessageIn
from features.ai_advisor.tools import ADVISOR_TOOLS, build_advisor_executor
from features.vendors.models import VendorProfile
from infra.llm import AgentRole, Message, Role, get_llm_client, run_agent, stream_agent
from settings.config.app_config import settings

logger = logging.getLogger("ai.advisor")

SYSTEM_PROMPT = (
    "Ты — ИИ-аналитик бизнеса для владельца точки фастфуда в сервисе предзаказа еды QUICK. "
    "Твоя задача — помогать улучшать продажи: объяснять, что покупают часто, что редко, "
    "когда пиковые часы, как меняется выручка и средний чек, и давать конкретные рекомендации. "
    "Всегда сначала получай данные через инструменты — не выдумывай цифры. Если данных нет, "
    "честно скажи об этом. Денежные суммы считай в рублях. Отвечай по-русски, кратко и по делу, "
    "структурированно (списки, короткие абзацы), с практическими действиями, а не общими словами."
)

INSIGHTS_PROMPT = (
    "Сделай разбор бизнеса за последние 30 дней. Используй инструменты, чтобы посмотреть продажи, "
    "пиковые часы, выручку по категориям, самые и наименее продаваемые позиции и отзывы. "
    "Затем дай сжатую сводку: 1) что идёт хорошо, 2) что проседает, 3) когда пик нагрузки, "
    "4) 3–5 конкретных рекомендаций, что улучшить или что добавить в меню. Без воды."
)


def _to_messages(items: Iterable[ChatMessageIn]) -> list[Message]:
    return [Message(role=Role(item.role), content=item.content) for item in items]


def _parse_uuid(value: str | None) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(value)
    except (TypeError, ValueError):
        return None


async def stream_chat(
    vendor: VendorProfile,
    history: Iterable[ChatMessageIn],
    restaurant_id: str | None = None,
) -> AsyncIterator[str]:
    client = get_llm_client(AgentRole.ADVISOR)
    try:
        async with db_helper.session_factory() as session:
            execute = build_advisor_executor(session, vendor, _parse_uuid(restaurant_id))
            async for chunk in stream_agent(
                client,
                system=SYSTEM_PROMPT,
                messages=_to_messages(history),
                tools=ADVISOR_TOOLS,
                execute=execute,
                max_steps=settings.llm.max_agent_steps,
            ):
                yield chunk
    except Exception:
        logger.exception("advisor chat stream failed")
        yield "\n\nИзвините, при анализе произошла ошибка. Попробуйте ещё раз позже."


async def generate_insights(vendor: VendorProfile) -> str:
    client = get_llm_client(AgentRole.ADVISOR)
    async with db_helper.session_factory() as session:
        execute = build_advisor_executor(session, vendor)
        text, _ = await run_agent(
            client,
            system=SYSTEM_PROMPT,
            messages=[Message(role=Role.USER, content=INSIGHTS_PROMPT)],
            tools=ADVISOR_TOOLS,
            execute=execute,
            max_steps=settings.llm.max_agent_steps,
        )
        return text
