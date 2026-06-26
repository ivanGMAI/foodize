"""Tool surface for the customer order agent.

Tools wrap the existing menu / cart / orders logic. The model only passes ids
and quantities; prices, availability and the single-restaurant rule are
enforced from the DB here, and every operation is scoped to the current user.
"""

import json
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from features.admin.crud import CATEGORY_RU
from features.ai_order_agent import search as search_mod
from features.cart.schemas import CartItemIn, CartResponse, CartSelectedOption, CartUpdate
from features.cart.service import CartService
from features.menu.crud import get_menu_item_by_id
from features.orders.schemas.order import OrderCreate, OrderItemCreate
from features.orders.services.order import place_order
from features.users.models import User
from infra.cache.redis import get_redis_cache
from infra.llm import ToolCall, ToolExecutor, ToolSpec

ORDER_TOOLS: list[ToolSpec] = [
    ToolSpec(
        name="search_menu",
        description=(
            "Найти позиции меню по тексту запроса (название/описание), с фильтром по "
            "максимальной цене и/или конкретному ресторану. Возвращает menu_item_id, "
            "цену, ресторан и адрес."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Что ищем, напр. 'острая шаурма'."},
                "max_price": {"type": "integer", "description": "Максимальная цена в рублях."},
                "restaurant_id": {"type": "string", "description": "UUID ресторана (опц.)."},
            },
            "required": ["query"],
        },
    ),
    ToolSpec(
        name="view_cart",
        description="Показать текущую корзину пользователя и итоговую сумму.",
        input_schema={"type": "object", "properties": {}},
    ),
    ToolSpec(
        name="add_to_cart",
        description=(
            "Добавить позицию в корзину. Корзина может содержать позиции только одного "
            "ресторана — если в ней товары из другого, сначала очистить (clear_cart)."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "menu_item_id": {"type": "string", "description": "UUID позиции меню."},
                "quantity": {"type": "integer", "description": "Количество (1–99), по умолч. 1."},
                "option_ids": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "UUID выбранных опций (опц.).",
                },
            },
            "required": ["menu_item_id"],
        },
    ),
    ToolSpec(
        name="remove_from_cart",
        description="Убрать позицию из корзины по menu_item_id.",
        input_schema={
            "type": "object",
            "properties": {"menu_item_id": {"type": "string"}},
            "required": ["menu_item_id"],
        },
    ),
    ToolSpec(
        name="clear_cart",
        description="Полностью очистить корзину.",
        input_schema={"type": "object", "properties": {}},
    ),
    ToolSpec(
        name="place_order",
        description=(
            "Оформить заказ из текущей корзины. Перед этим подтвердите состав у пользователя."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "comment": {"type": "string", "description": "Комментарий к заказу (опц.)."},
                "promo_code": {"type": "string", "description": "Промокод (опц.)."},
            },
        },
    ),
]


def _dumps(payload: object) -> str:
    return json.dumps(payload, ensure_ascii=False, default=str)


def _parse_uuid(value) -> uuid.UUID | None:
    if not value:
        return None
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError):
        return None


def _existing_items(cart: CartResponse) -> list[CartItemIn]:
    items: list[CartItemIn] = []
    for it in cart.items:
        items.append(
            CartItemIn(
                menu_item_id=it.menuItem.id,
                name=it.menuItem.name,
                price=it.menuItem.price,
                image_url=it.menuItem.image_url,
                quantity=it.quantity,
                selected_option_ids=list(it.selected_option_ids),
                selected_options=[
                    CartSelectedOption(
                        option_id=o.option_id, name=o.name, price_delta=o.price_delta
                    )
                    for o in it.selected_options
                ],
            )
        )
    return items


def build_order_executor(
    session: AsyncSession,
    user: User,
    cart_service: CartService,
) -> ToolExecutor:
    identifier = str(user.id)

    async def _cart_summary() -> dict:
        cart = await cart_service.get_cart(identifier)
        items = []
        total = 0
        for it in cart.items:
            options_sum = sum(o.price_delta for o in it.selected_options)
            unit = it.menuItem.price + options_sum
            line_total = unit * it.quantity
            total += line_total
            items.append(
                {
                    "menu_item_id": str(it.menuItem.id),
                    "name": it.menuItem.name,
                    "quantity": it.quantity,
                    "unit_price": unit,
                    "options": [o.name for o in it.selected_options],
                    "line_total": line_total,
                }
            )
        return {
            "restaurant_id": str(cart.restaurant_id) if cart.restaurant_id else None,
            "items": items,
            "total": total,
        }

    async def _search(args: dict) -> str:
        results = await search_mod.semantic_search(
            session,
            get_redis_cache(),
            query=args.get("query"),
            max_price=args.get("max_price"),
            restaurant_id=_parse_uuid(args.get("restaurant_id")),
        )
        for r in results:
            r["category"] = CATEGORY_RU.get(r["category"], r["category"])
        if not results:
            return _dumps(
                {
                    "results": [],
                    "message": (
                        "Сейчас нет доступных ресторанов или блюд. Повторять поиск не нужно — "
                        "сообщи об этом пользователю."
                    ),
                }
            )
        return _dumps({"results": results})

    async def _view_cart(_args: dict) -> str:
        return _dumps(await _cart_summary())

    async def _add(args: dict) -> str:
        item_id = _parse_uuid(args.get("menu_item_id"))
        if item_id is None:
            return _dumps({"error": "invalid_menu_item_id"})
        item = await get_menu_item_by_id(session, item_id)
        if item is None or item.is_deleted or not item.is_available:
            return _dumps({"error": "item_unavailable", "message": "Позиция недоступна."})

        try:
            quantity = max(1, min(int(args.get("quantity") or 1), 99))
        except (TypeError, ValueError):
            quantity = 1

        available_options = {
            o.id: o for group in item.option_groups for o in group.options if o.is_available
        }
        valid_options: list[CartSelectedOption] = []
        valid_ids: list[uuid.UUID] = []
        for raw in args.get("option_ids") or []:
            oid = _parse_uuid(raw)
            if oid is None:
                continue
            option = available_options.get(oid)
            if option is not None:
                valid_options.append(
                    CartSelectedOption(
                        option_id=option.id, name=option.name, price_delta=option.price_delta
                    )
                )
                valid_ids.append(option.id)

        cart = await cart_service.get_cart(identifier)
        if cart.items and cart.restaurant_id and str(cart.restaurant_id) != str(item.restaurant_id):
            return _dumps(
                {
                    "error": "cart_has_other_restaurant",
                    "message": (
                        "В корзине позиции из другого ресторана. Очистите её (clear_cart), "
                        "чтобы заказать в этом."
                    ),
                }
            )

        items = _existing_items(cart)
        option_key = tuple(sorted(str(x) for x in valid_ids))
        merged = False
        for existing in items:
            same_options = tuple(sorted(str(x) for x in existing.selected_option_ids)) == option_key
            if str(existing.menu_item_id) == str(item.id) and same_options:
                existing.quantity = min(99, existing.quantity + quantity)
                merged = True
                break
        if not merged:
            items.append(
                CartItemIn(
                    menu_item_id=item.id,
                    name=item.name,
                    price=item.price,
                    image_url=item.photo_url,
                    quantity=quantity,
                    selected_option_ids=valid_ids,
                    selected_options=valid_options,
                )
            )

        await cart_service.update_cart(
            identifier, CartUpdate(restaurant_id=item.restaurant_id, items=items)
        )
        return _dumps({"ok": True, "cart": await _cart_summary()})

    async def _remove(args: dict) -> str:
        item_id = _parse_uuid(args.get("menu_item_id"))
        if item_id is None:
            return _dumps({"error": "invalid_menu_item_id"})
        cart = await cart_service.get_cart(identifier)
        items = [i for i in _existing_items(cart) if str(i.menu_item_id) != str(item_id)]
        if not items or cart.restaurant_id is None:
            await cart_service.clear_cart(identifier)
        else:
            await cart_service.update_cart(
                identifier, CartUpdate(restaurant_id=cart.restaurant_id, items=items)
            )
        return _dumps({"ok": True, "cart": await _cart_summary()})

    async def _clear(_args: dict) -> str:
        await cart_service.clear_cart(identifier)
        return _dumps({"ok": True, "cart": {"items": [], "total": 0}})

    async def _place(args: dict) -> str:
        cart = await cart_service.get_cart(identifier)
        if not cart.items or not cart.restaurant_id:
            return _dumps({"error": "cart_empty", "message": "Корзина пуста."})

        order_in = OrderCreate(
            restaurant_id=cart.restaurant_id,
            items=[
                OrderItemCreate(
                    menu_item_id=it.menuItem.id,
                    quantity=it.quantity,
                    selected_option_ids=list(it.selected_option_ids),
                )
                for it in cart.items
            ],
            promo_code=args.get("promo_code"),
            comment=args.get("comment"),
        )
        result = await place_order(
            session=session,
            order_data=order_in,
            user_id=user.id,
            idempotency_key=uuid.uuid4().hex,
        )
        await cart_service.clear_cart(identifier)
        data = result.model_dump()
        return _dumps(
            {
                "ok": True,
                "order": {
                    "number": data.get("display_id"),
                    "status": data.get("status"),
                    "total_price": data.get("total_price"),
                },
            }
        )

    handlers = {
        "search_menu": _search,
        "view_cart": _view_cart,
        "add_to_cart": _add,
        "remove_from_cart": _remove,
        "clear_cart": _clear,
        "place_order": _place,
    }

    async def execute(call: ToolCall) -> str:
        handler = handlers.get(call.name)
        if handler is None:
            return _dumps({"error": f"Unknown tool: {call.name}"})
        return await handler(call.arguments or {})

    return execute
