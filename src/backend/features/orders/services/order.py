import hashlib
import json
import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from features.admin.audit_log import service as audit_service
from features.menu.models import MenuItem, MenuItemOption
from features.notifications.events import OrderPlacedEvent, OrderStatusChangedEvent
from features.notifications.outbox_service import enqueue_event
from features.orders.crud import order as order_crud
from features.orders.crud import order_item as order_item_crud
from features.orders.exceptions import (
    InvalidStatusTransitionException,
    MenuItemRestaurantMismatchException,
    MenuItemsNotFoundException,
    MenuItemUnavailableException,
    OrderAccessDeniedException,
    OrderNotCancellableException,
    OrderNotCompletableException,
    OrderNotFoundException,
    OrderReadyTimeRequiredException,
)
from features.orders.models import IdempotencyKey, Order, OrderItem, OrderItemOption
from features.orders.schemas.order import (
    OrderCancelRequest,
    OrderCreate,
    OrderLoadEstimate,
    OrderResponse,
    OrderStatusUpdate,
)
from features.orders.schemas.order_event import OrderEventResponse
from features.promos import service as promo_service
from features.restaurants import crud as restaurant_crud
from features.restaurants.exceptions import RestaurantClosedException, RestaurantNotFoundException
from features.restaurants.working_hours_crud import get_working_hours, is_open_now
from features.users.models import User
from infra.cache.redis import get_redis_cache
from shared.enums.order_status import OrderStatus
from shared.enums.selection_type import SelectionType
from shared.exceptions import BadRequestException
from shared.permissions import CUSTOMER_PERMISSIONS, serialize_permissions

_ALLOWED_TRANSITIONS: dict[OrderStatus, set[OrderStatus]] = {
    OrderStatus.PENDING: {OrderStatus.ACCEPTED},
    OrderStatus.ACCEPTED: {OrderStatus.READY},
    OrderStatus.READY: {OrderStatus.COMPLETED},
    OrderStatus.COMPLETED: set(),
    OrderStatus.CANCELLED: set(),
}

_CANCELLABLE_STATUSES = {OrderStatus.PENDING, OrderStatus.ACCEPTED}
_PICKUP_TIME_HORIZON_DAYS = 7


def _is_ordering_paused(restaurant) -> bool:
    if getattr(restaurant, "is_ordering_paused", False) is not True:
        return False
    paused_until = restaurant.ordering_paused_until
    if paused_until is None:
        return True
    if paused_until.tzinfo is None:
        paused_until = paused_until.replace(tzinfo=timezone.utc)
    return paused_until > datetime.now(timezone.utc)


async def estimate_restaurant_load(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
) -> OrderLoadEstimate:
    restaurant = await restaurant_crud.get_restaurant_by_id(session, restaurant_id)
    if not restaurant:
        raise RestaurantNotFoundException()

    active_orders = await order_crud.count_active_orders_by_restaurant_id(session, restaurant.id)
    if not isinstance(active_orders, int):
        active_orders = 0
    avg_prep_time = getattr(restaurant, "avg_prep_time_minutes", 15)
    if not isinstance(avg_prep_time, int):
        avg_prep_time = 15
    max_active_orders = getattr(restaurant, "max_active_orders", None)
    if not isinstance(max_active_orders, int):
        max_active_orders = None
    hours = await get_working_hours(session, restaurant.id)
    is_open = restaurant.is_open
    if hours and is_open_now(hours) is False:
        is_open = False
    queue_multiplier = 1
    if max_active_orders:
        queue_multiplier = max(1, active_orders // max_active_orders + 1)

    wait_min = max(avg_prep_time, avg_prep_time * queue_multiplier)
    wait_max = wait_min + max(10, avg_prep_time)
    paused = _is_ordering_paused(restaurant)

    return OrderLoadEstimate(
        restaurant_id=restaurant.id,
        ordering_available=not paused and is_open,
        reason="PAUSED" if paused else ("CLOSED" if not is_open else None),
        active_orders_count=active_orders,
        max_active_orders=max_active_orders,
        avg_prep_time_minutes=avg_prep_time,
        estimated_wait_min_minutes=wait_min,
        estimated_wait_max_minutes=wait_max,
        paused_until=restaurant.ordering_paused_until if paused else None,
    )


def _validate_transition(old: OrderStatus, new: OrderStatus) -> None:
    if new not in _ALLOWED_TRANSITIONS.get(old, set()):
        raise InvalidStatusTransitionException()


def _validate_item_options(
    item_data,
    menu_item: MenuItem,
    options_by_id: dict[uuid.UUID, MenuItemOption],
) -> list[MenuItemOption]:
    selected_ids = item_data.selected_option_ids
    if len(selected_ids) != len(set(selected_ids)):
        raise BadRequestException(detail="Duplicate options selected")

    selected_options: list[MenuItemOption] = []
    selected_by_group: dict[uuid.UUID, int] = {}

    for option_id in selected_ids:
        option = options_by_id.get(option_id)
        if not option:
            raise BadRequestException(detail="Selected option not found")
        if option.group.menu_item_id != menu_item.id:
            raise BadRequestException(detail="Selected option does not belong to menu item")
        if not option.group.is_active or not option.is_available:
            raise BadRequestException(detail="Selected option is not available")
        selected_options.append(option)
        selected_by_group[option.group_id] = selected_by_group.get(option.group_id, 0) + 1

    for group in menu_item.option_groups:
        if not group.is_active:
            continue
        selected_count = selected_by_group.get(group.id, 0)
        min_selected = group.min_selected
        if group.is_required:
            min_selected = max(1, min_selected)
        if selected_count < min_selected:
            raise BadRequestException(detail=f"Not enough options selected for {group.name}")
        if group.max_selected is not None and selected_count > group.max_selected:
            raise BadRequestException(detail=f"Too many options selected for {group.name}")
        if group.selection_type == SelectionType.SINGLE.value and selected_count > 1:
            raise BadRequestException(detail=f"Only one option can be selected for {group.name}")

    return selected_options


def _make_request_hash(order_data: OrderCreate) -> str:
    payload = order_data.model_dump(mode="json")
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def _as_aware_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _validate_requested_pickup_at(
    requested_pickup_at: datetime | None,
    min_ready_at: datetime,
) -> datetime | None:
    if requested_pickup_at is None:
        return None

    pickup_at = _as_aware_utc(requested_pickup_at)
    now = datetime.now(timezone.utc)
    latest = now + timedelta(days=_PICKUP_TIME_HORIZON_DAYS)

    if pickup_at < min_ready_at:
        raise BadRequestException(detail="Pickup time is too soon for the current restaurant load")
    if pickup_at > latest:
        raise BadRequestException(
            detail=f"Pickup time must be within {_PICKUP_TIME_HORIZON_DAYS} days"
        )
    return pickup_at


def _is_open_at(hours, value: datetime) -> bool | None:
    if not hours:
        return None
    pickup_at = _as_aware_utc(value)
    day_of_week = pickup_at.weekday()
    current_time = pickup_at.strftime("%H:%M")
    for entry in hours:
        if entry.day_of_week == day_of_week:
            if entry.is_closed:
                return False
            return entry.open_time <= current_time < entry.close_time
    return None


async def _get_idempotency_record(
    session: AsyncSession,
    user_id: uuid.UUID,
    key: str,
) -> IdempotencyKey | None:
    result = await session.execute(
        select(IdempotencyKey).where(
            IdempotencyKey.user_id == user_id,
            IdempotencyKey.key == key,
        )
    )
    return result.scalar_one_or_none()


async def _start_idempotency_record(
    session: AsyncSession,
    user_id: uuid.UUID,
    key: str | None,
    request_hash: str,
) -> IdempotencyKey | None:
    if not key:
        return None

    existing = await _get_idempotency_record(session, user_id, key)
    if existing:
        if existing.request_hash != request_hash:
            raise BadRequestException(detail="Idempotency key was used with different payload")
        if existing.response_json:
            return existing
        raise BadRequestException(detail="Idempotent request is still being processed")

    record = IdempotencyKey(user_id=user_id, key=key, request_hash=request_hash)
    session.add(record)
    await session.flush()
    return record


async def place_order(
    session: AsyncSession,
    order_data: OrderCreate,
    user_id: uuid.UUID,
    idempotency_key: str | None = None,
) -> OrderResponse:
    request_hash = _make_request_hash(order_data)
    idempotency_record = await _start_idempotency_record(
        session, user_id, idempotency_key, request_hash
    )
    if idempotency_record and idempotency_record.response_json:
        return OrderResponse.model_validate(idempotency_record.response_json)

    restaurant = await restaurant_crud.get_restaurant_by_id(session, order_data.restaurant_id)
    if not restaurant:
        raise RestaurantNotFoundException()
    if not restaurant.is_open:
        raise RestaurantClosedException()
    if _is_ordering_paused(restaurant):
        raise RestaurantClosedException(detail="Restaurant is temporarily not accepting orders")

    working_hours = await get_working_hours(session, restaurant.id)
    if working_hours:
        is_open = is_open_now(working_hours)
        if is_open is False:
            raise RestaurantClosedException(
                detail="Restaurant is currently closed (outside working hours)"
            )

    menu_item_ids = [item.menu_item_id for item in order_data.items]
    menu_items = await order_item_crud.get_menu_items_by_ids(session, menu_item_ids)

    if len(menu_items) != len(menu_item_ids):
        raise MenuItemsNotFoundException()

    if any(mi.restaurant_id != order_data.restaurant_id for mi in menu_items.values()):
        raise MenuItemRestaurantMismatchException()

    if any(not mi.is_available for mi in menu_items.values()):
        raise MenuItemUnavailableException()

    selected_option_ids = [
        option_id for item in order_data.items for option_id in item.selected_option_ids
    ]
    options_by_id = await order_item_crud.get_options_by_ids(session, selected_option_ids)

    selected_options_by_item = {
        index: _validate_item_options(item, menu_items[item.menu_item_id], options_by_id)
        for index, item in enumerate(order_data.items)
    }

    total_orders = await order_crud.count_orders_by_user_id(
        session, user_id, exclude_status=OrderStatus.CANCELLED
    )
    is_first_order = total_orders == 0

    load = await estimate_restaurant_load(session, restaurant.id)
    min_ready_at = datetime.now(timezone.utc) + timedelta(minutes=load.estimated_wait_min_minutes)
    fallback_ready_at = datetime.now(timezone.utc) + timedelta(
        minutes=load.estimated_wait_max_minutes
    )
    requested_pickup_at = _validate_requested_pickup_at(
        order_data.requested_pickup_at,
        min_ready_at,
    )
    if (
        requested_pickup_at
        and working_hours
        and _is_open_at(working_hours, requested_pickup_at) is False
    ):
        raise RestaurantClosedException(detail="Restaurant is closed at requested pickup time")

    order = await _create_order(
        session,
        order_data,
        user_id,
        menu_items,
        selected_options_by_item,
        estimated_ready_at=requested_pickup_at or fallback_ready_at,
        requested_pickup_at=requested_pickup_at,
    )

    if order_data.promo_code:
        new_total = await promo_service.apply_promo(
            session,
            order_data.promo_code,
            order_data.restaurant_id,
            order.total_price,
            is_first_order=is_first_order,
        )
        if new_total != order.total_price:
            order.total_price = new_total

    await enqueue_event(
        session,
        OrderPlacedEvent(
            order_id=order.id,
            order_display_id=str(order.display_id),
            user_id=order.user_id,
            restaurant_id=order.restaurant_id,
            restaurant_name=restaurant.name,
            total_price=order.total_price,
            items_count=len(order_data.items),
        ),
    )
    await session.commit()

    result = await order_crud.get_order_by_id(session, order.id)
    if result is None:
        raise OrderNotFoundException()
    response = OrderResponse.model_validate(result)

    if idempotency_record:
        idempotency_record.order_id = order.id
        idempotency_record.response_json = response.model_dump(mode="json")
        idempotency_record.completed_at = datetime.now(timezone.utc)
        await session.commit()

    await get_redis_cache().publish(f"restaurant_orders:{order.restaurant_id}", "new_order")
    return response


async def _create_order(
    session: AsyncSession,
    order_data: OrderCreate,
    user_id: uuid.UUID,
    menu_items: dict,
    selected_options_by_item: dict[int, list[MenuItemOption]],
    estimated_ready_at: datetime | None = None,
    requested_pickup_at: datetime | None = None,
) -> Order:
    total_price = sum(
        (
            menu_items[item.menu_item_id].price
            + sum(option.price_delta for option in selected_options_by_item[index])
        )
        * item.quantity
        for index, item in enumerate(order_data.items)
    )
    order = Order(
        user_id=user_id,
        restaurant_id=order_data.restaurant_id,
        total_price=total_price,
        comment=order_data.comment,
        requested_pickup_at=requested_pickup_at,
        estimated_ready_at=estimated_ready_at,
    )
    session.add(order)
    await session.flush()

    for index, item_data in enumerate(order_data.items):
        order_item = OrderItem(
            order_id=order.id,
            menu_item_id=item_data.menu_item_id,
            quantity=item_data.quantity,
            price_at_purchase=menu_items[item_data.menu_item_id].price,
        )
        session.add(order_item)
        await session.flush()
        for option in selected_options_by_item[index]:
            session.add(
                OrderItemOption(
                    order_item_id=order_item.id,
                    option_id=option.id,
                    name_snapshot=option.name,
                    price_delta_snapshot=option.price_delta,
                )
            )

    await session.flush()
    return order


async def get_user_orders(
    session: AsyncSession,
    user_id: uuid.UUID,
    status: OrderStatus | None = None,
    page: int = 1,
    size: int = 20,
) -> tuple[list[OrderResponse], int]:
    offset = (page - 1) * size
    data = await order_crud.get_orders_by_user_id(
        session, user_id, status=status, offset=offset, limit=size
    )
    total = await order_crud.count_orders_by_user_id(session, user_id, status=status)
    return [OrderResponse.model_validate(o) for o in data], total


async def get_order(
    session: AsyncSession,
    order_id: uuid.UUID,
    user_id: uuid.UUID,
) -> OrderResponse:
    order = await order_crud.get_order_by_id(session, order_id)
    if not order:
        raise OrderNotFoundException()
    if order.user_id != user_id:
        raise OrderAccessDeniedException()
    return OrderResponse.model_validate(order)


async def get_restaurant_orders(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    status: OrderStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = 1,
    size: int = 20,
) -> tuple[list[OrderResponse], int]:
    offset = (page - 1) * size
    data = await order_crud.get_orders_by_restaurant_id(
        session,
        restaurant_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
        offset=offset,
        limit=size,
    )
    total = await order_crud.count_orders_by_restaurant_id(
        session,
        restaurant_id,
        status=status,
        date_from=date_from,
        date_to=date_to,
    )
    return [OrderResponse.model_validate(o) for o in data], total


async def change_order_status(
    session: AsyncSession,
    order: Order,
    status_data: OrderStatusUpdate,
    actor: User,
) -> OrderResponse:
    old_status = OrderStatus(order.status)
    _validate_transition(old_status, status_data.status)
    if status_data.status == OrderStatus.ACCEPTED:
        if status_data.estimated_ready_at:
            order.estimated_ready_at = status_data.estimated_ready_at
        else:
            minutes = status_data.estimated_ready_in_minutes
            if minutes:
                order.estimated_ready_at = datetime.now(timezone.utc) + timedelta(minutes=minutes)
            else:
                raise OrderReadyTimeRequiredException()
    updated = await order_crud.update_order_status(session, order, status_data.status)
    await order_crud.create_order_event(
        session,
        order_id=order.id,
        actor_id=actor.id,
        actor_permissions=actor.permissions,
        old_status=old_status,
        new_status=status_data.status,
    )
    await enqueue_event(
        session,
        OrderStatusChangedEvent(
            order_id=order.id,
            order_display_id=str(order.display_id),
            user_id=order.user_id,
            restaurant_id=order.restaurant_id,
            restaurant_name=order.restaurant.name,
            old_status=old_status,
            new_status=status_data.status,
            total_price=order.total_price,
        ),
    )
    await session.commit()
    await get_redis_cache().publish(f"order_status:{order.id}", status_data.status.value)
    await get_redis_cache().publish(
        f"restaurant_orders:{order.restaurant_id}",
        f"status_changed:{status_data.status.value}",
    )
    return OrderResponse.model_validate(updated)


async def complete_order(
    session: AsyncSession,
    identifier: str | uuid.UUID,
    user_id: uuid.UUID,
) -> OrderResponse:
    order = await order_crud.get_order_by_identifier(session, str(identifier))
    if not order:
        raise OrderNotFoundException()
    if order.user_id != user_id:
        raise OrderAccessDeniedException()
    if order.status != OrderStatus.READY.value:
        raise OrderNotCompletableException()
    old_status = OrderStatus(order.status)
    completed = await order_crud.update_order_status(session, order, OrderStatus.COMPLETED)
    await order_crud.create_order_event(
        session,
        order_id=order.id,
        actor_id=user_id,
        actor_permissions=serialize_permissions(CUSTOMER_PERMISSIONS),
        old_status=old_status,
        new_status=OrderStatus.COMPLETED,
    )
    await enqueue_event(
        session,
        OrderStatusChangedEvent(
            order_id=order.id,
            order_display_id=str(order.display_id),
            user_id=order.user_id,
            restaurant_id=order.restaurant_id,
            restaurant_name=order.restaurant.name,
            old_status=old_status,
            new_status=OrderStatus.COMPLETED,
            total_price=order.total_price,
        ),
    )
    await session.commit()
    await get_redis_cache().publish(f"order_status:{order.id}", OrderStatus.COMPLETED.value)
    await get_redis_cache().publish(
        f"restaurant_orders:{order.restaurant_id}",
        f"status_changed:{OrderStatus.COMPLETED.value}",
    )
    return OrderResponse.model_validate(completed)


async def cancel_order(
    session: AsyncSession,
    identifier: str | uuid.UUID,
    user_id: uuid.UUID,
    cancel_data: OrderCancelRequest,
) -> OrderResponse:
    order = await order_crud.get_order_by_identifier(session, str(identifier))
    if not order:
        raise OrderNotFoundException()
    if order.user_id != user_id:
        raise OrderAccessDeniedException()
    old_status = OrderStatus(order.status)
    if old_status not in _CANCELLABLE_STATUSES:
        raise OrderNotCancellableException()
    order.cancellation_reason = cancel_data.reason
    updated = await order_crud.update_order_status(session, order, OrderStatus.CANCELLED)
    await order_crud.create_order_event(
        session,
        order_id=order.id,
        actor_id=user_id,
        actor_permissions=serialize_permissions(CUSTOMER_PERMISSIONS),
        old_status=old_status,
        new_status=OrderStatus.CANCELLED,
    )
    await enqueue_event(
        session,
        OrderStatusChangedEvent(
            order_id=order.id,
            order_display_id=str(order.display_id),
            user_id=order.user_id,
            restaurant_id=order.restaurant_id,
            restaurant_name=order.restaurant.name,
            old_status=old_status,
            new_status=OrderStatus.CANCELLED,
            total_price=order.total_price,
        ),
    )
    await session.commit()
    await get_redis_cache().publish(f"order_status:{order.id}", OrderStatus.CANCELLED.value)
    await get_redis_cache().publish(
        f"restaurant_orders:{order.restaurant_id}",
        f"status_changed:{OrderStatus.CANCELLED.value}",
    )
    return OrderResponse.model_validate(updated)


async def get_order_events(
    session: AsyncSession,
    order_id: uuid.UUID,
) -> list[OrderEventResponse]:
    events = await order_crud.get_events_by_order_id(session, order_id)
    return [OrderEventResponse.model_validate(e) for e in events]


async def force_cancel_order(
    session: AsyncSession,
    order_id: uuid.UUID,
    actor: User,
    reason: str,
) -> OrderResponse:
    order = await order_crud.get_order_by_id(session, order_id)
    if not order:
        raise OrderNotFoundException()

    old_status = OrderStatus(order.status)
    order.cancellation_reason = reason
    updated = await order_crud.update_order_status(session, order, OrderStatus.CANCELLED)

    await order_crud.create_order_event(
        session,
        order_id=order.id,
        actor_id=actor.id,
        actor_permissions=actor.permissions,
        old_status=old_status,
        new_status=OrderStatus.CANCELLED,
    )
    await audit_service.log_action(
        session,
        actor_id=actor.id,
        action="FORCE_CANCEL_ORDER",
        entity_type="order",
        entity_id=order.id,
        details={"reason": reason, "old_status": old_status.value},
    )

    await enqueue_event(
        session,
        OrderStatusChangedEvent(
            order_id=order.id,
            order_display_id=str(order.display_id),
            user_id=order.user_id,
            restaurant_id=order.restaurant_id,
            restaurant_name=order.restaurant.name,
            old_status=old_status,
            new_status=OrderStatus.CANCELLED,
            total_price=order.total_price,
        ),
    )

    await session.commit()
    await get_redis_cache().publish(f"order_status:{order.id}", OrderStatus.CANCELLED.value)
    await get_redis_cache().publish(
        f"restaurant_orders:{order.restaurant_id}",
        f"status_changed:{OrderStatus.CANCELLED.value}",
    )
    return OrderResponse.model_validate(updated)
