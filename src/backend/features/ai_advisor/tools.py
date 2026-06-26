"""Tool surface for the vendor AI advisor.

Each tool wraps existing analytics (``features/admin/crud.py``) or the
vendor-scoped queries in ``features/ai_advisor/crud.py``. The executor binds a
DB session and the current vendor, so the model only supplies high-level
arguments (period, restaurant) — the ``vendor_id`` scope is enforced here, never
trusted from model output.
"""

import json
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from features.admin.crud import CATEGORY_RU, get_advanced_analytics, get_finance_analytics
from features.ai_advisor import crud
from features.vendors.models import VendorProfile
from infra.llm import ToolCall, ToolExecutor, ToolSpec

_PERIOD = {
    "type": "integer",
    "description": "Сколько последних дней анализировать (по умолчанию 30).",
}
_RESTAURANT = {
    "type": "string",
    "description": "UUID конкретной точки. Опустить, чтобы взять все точки вендора.",
}


ADVISOR_TOOLS: list[ToolSpec] = [
    ToolSpec(
        name="get_sales_summary",
        description=(
            "Сводка продаж за период: выручка, средний чек, число заказов, "
            "конверсия, рост к прошлому периоду, топ-позиции и топ-точки."
        ),
        input_schema={
            "type": "object",
            "properties": {"period_days": _PERIOD, "restaurant_id": _RESTAURANT},
        },
    ),
    ToolSpec(
        name="get_peak_hours",
        description="Загрузка по часам суток (число завершённых заказов в каждый час).",
        input_schema={
            "type": "object",
            "properties": {"period_days": _PERIOD, "restaurant_id": _RESTAURANT},
        },
    ),
    ToolSpec(
        name="get_category_breakdown",
        description="Выручка по категориям блюд за период.",
        input_schema={
            "type": "object",
            "properties": {"period_days": _PERIOD, "restaurant_id": _RESTAURANT},
        },
    ),
    ToolSpec(
        name="get_top_and_bottom_items",
        description=(
            "Самые продаваемые и самые редко покупаемые (вплоть до ни разу не "
            "проданных) позиции меню за период."
        ),
        input_schema={
            "type": "object",
            "properties": {"period_days": _PERIOD, "restaurant_id": _RESTAURANT},
        },
    ),
    ToolSpec(
        name="get_menu",
        description="Текущее меню вендора: позиции, категории, цены, доступность.",
        input_schema={
            "type": "object",
            "properties": {"restaurant_id": _RESTAURANT},
        },
    ),
    ToolSpec(
        name="get_reviews_summary",
        description="Сводка отзывов: средний рейтинг, распределение оценок, свежие тексты.",
        input_schema={
            "type": "object",
            "properties": {"restaurant_id": _RESTAURANT},
        },
    ),
]


def _dumps(payload: object) -> str:
    return json.dumps(payload, ensure_ascii=False, default=str)


def _period_range(args: dict) -> tuple:
    period = args.get("period_days") or 30
    try:
        period = max(1, min(int(period), 365))
    except (TypeError, ValueError):
        period = 30
    end = datetime.now(UTC).date()
    start = end - timedelta(days=period - 1)
    return start, end


def _restaurant_id(args: dict) -> uuid.UUID | None:
    raw = args.get("restaurant_id")
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except (TypeError, ValueError):
        return None


def build_advisor_executor(
    session: AsyncSession,
    vendor: VendorProfile,
    default_restaurant_id: uuid.UUID | None = None,
) -> ToolExecutor:
    vendor_id = vendor.id

    def resolve_restaurant(args: dict) -> uuid.UUID | None:
        return _restaurant_id(args) or default_restaurant_id

    async def _sales_summary(args: dict) -> str:
        start, end = _period_range(args)
        data = await get_finance_analytics(
            session,
            date_from=start,
            date_to=end,
            vendor_id=vendor_id,
            restaurant_id=resolve_restaurant(args),
        )
        return _dumps(
            {
                "period": {"from": str(start), "to": str(end)},
                "total_revenue": data.total_revenue,
                "average_check": data.average_check,
                "total_orders": data.total_orders,
                "completed_orders": data.completed_orders,
                "cancelled_orders": data.cancelled_orders,
                "conversion_percent": data.conversion_percent,
                "revenue_growth_pct": data.revenue_growth_pct,
                "top_items": [
                    {"name": i.name, "quantity": i.quantity, "revenue": i.revenue}
                    for i in data.top_items
                ],
                "top_restaurants": [
                    {"name": r.name, "revenue": r.revenue, "orders": r.orders_count}
                    for r in data.top_restaurants
                ],
            }
        )

    async def _peak_hours(args: dict) -> str:
        start, end = _period_range(args)
        data = await get_advanced_analytics(
            session,
            date_from=start,
            date_to=end,
            vendor_id=vendor_id,
            restaurant_id=resolve_restaurant(args),
        )
        return _dumps(
            {
                "period": {"from": str(start), "to": str(end)},
                "hourly_load": [{"hour": p.label, "orders": p.value} for p in data.hourly_load],
            }
        )

    async def _category_breakdown(args: dict) -> str:
        start, end = _period_range(args)
        data = await get_advanced_analytics(
            session,
            date_from=start,
            date_to=end,
            vendor_id=vendor_id,
            restaurant_id=resolve_restaurant(args),
        )
        return _dumps(
            {
                "period": {"from": str(start), "to": str(end)},
                "category_revenue": [
                    {"category": p.label, "revenue": p.value} for p in data.category_revenue
                ],
            }
        )

    async def _top_and_bottom(args: dict) -> str:
        start, end = _period_range(args)
        restaurant_id = resolve_restaurant(args)
        finance = await get_finance_analytics(
            session,
            date_from=start,
            date_to=end,
            vendor_id=vendor_id,
            restaurant_id=restaurant_id,
        )
        bottom = await crud.get_bottom_items(
            session,
            vendor_id=vendor_id,
            start_date=start,
            end_date=end,
            restaurant_id=restaurant_id,
        )
        for item in bottom:
            item["category"] = CATEGORY_RU.get(item["category"], item["category"])
        return _dumps(
            {
                "period": {"from": str(start), "to": str(end)},
                "top_items": [
                    {"name": i.name, "quantity": i.quantity, "revenue": i.revenue}
                    for i in finance.top_items
                ],
                "bottom_items": bottom,
            }
        )

    async def _menu(args: dict) -> str:
        items = await crud.get_menu_overview(
            session, vendor_id=vendor_id, restaurant_id=resolve_restaurant(args)
        )
        for item in items:
            item["category"] = CATEGORY_RU.get(item["category"], item["category"])
        return _dumps({"items": items})

    async def _reviews(args: dict) -> str:
        return _dumps(
            await crud.get_reviews_summary(
                session, vendor_id=vendor_id, restaurant_id=resolve_restaurant(args)
            )
        )

    handlers = {
        "get_sales_summary": _sales_summary,
        "get_peak_hours": _peak_hours,
        "get_category_breakdown": _category_breakdown,
        "get_top_and_bottom_items": _top_and_bottom,
        "get_menu": _menu,
        "get_reviews_summary": _reviews,
    }

    async def execute(call: ToolCall) -> str:
        handler = handlers.get(call.name)
        if handler is None:
            return _dumps({"error": f"Unknown tool: {call.name}"})
        return await handler(call.arguments or {})

    return execute
