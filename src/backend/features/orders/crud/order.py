import uuid
from collections.abc import Sequence
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from features.orders.models import Order, OrderEvent, OrderItem
from shared.enums.order_status import OrderStatus
from shared.enums.permissions import Permission
from shared.permissions import serialize_permissions


def _items_options() -> Any:
    return (
        selectinload(Order.items).selectinload(OrderItem.menu_item),
        selectinload(Order.items).selectinload(OrderItem.selected_options),
        selectinload(Order.user),
    )


def _full_options() -> tuple[Any, Any]:
    return *_items_options(), selectinload(Order.restaurant)


async def get_orders_by_user_id(
    session: AsyncSession,
    user_id: uuid.UUID,
    status: OrderStatus | None = None,
    offset: int = 0,
    limit: int = 20,
) -> list[Order]:
    stmt = select(Order).where(Order.user_id == user_id).options(*_full_options())
    if status is not None:
        stmt = stmt.where(Order.status == status.value)
    stmt = stmt.order_by(Order.created_at.desc()).offset(offset).limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_order_by_id(session: AsyncSession, order_id: uuid.UUID) -> Order | None:
    result = await session.execute(
        select(Order).where(Order.id == order_id).options(*_full_options())
    )
    return result.scalar_one_or_none()


async def get_order_by_identifier(session: AsyncSession, identifier: str) -> Order | None:
    try:
        parsed_uuid = uuid.UUID(identifier)
        return await get_order_by_id(session, parsed_uuid)
    except ValueError:
        try:
            display_id = int(identifier)
            result = await session.execute(
                select(Order).where(Order.display_id == display_id).options(*_full_options())
            )
            return result.scalar_one_or_none()
        except ValueError:
            return None


async def get_orders_by_restaurant_id(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    status: OrderStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    offset: int = 0,
    limit: int = 20,
) -> list[Order]:
    stmt = (
        select(Order)
        .where(Order.restaurant_id == restaurant_id)
        .order_by(Order.created_at.desc())
        .options(*_full_options())
    )
    if status is not None:
        stmt = stmt.where(Order.status == status.value)
    if date_from is not None:
        stmt = stmt.where(func.date(Order.created_at) >= date_from)
    if date_to is not None:
        stmt = stmt.where(func.date(Order.created_at) <= date_to)
    stmt = stmt.offset(offset).limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def count_orders_by_user_id(
    session: AsyncSession,
    user_id: uuid.UUID,
    status: OrderStatus | None = None,
    exclude_status: OrderStatus | None = None,
) -> int:
    stmt = select(func.count()).select_from(Order).where(Order.user_id == user_id)
    if status is not None:
        stmt = stmt.where(Order.status == status.value)
    if exclude_status is not None:
        stmt = stmt.where(Order.status != exclude_status.value)
    result = await session.execute(stmt)
    return result.scalar_one()


async def count_orders_by_restaurant_id(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    status: OrderStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> int:
    stmt = select(func.count()).select_from(Order).where(Order.restaurant_id == restaurant_id)
    if status is not None:
        stmt = stmt.where(Order.status == status.value)
    if date_from is not None:
        stmt = stmt.where(func.date(Order.created_at) >= date_from)
    if date_to is not None:
        stmt = stmt.where(func.date(Order.created_at) <= date_to)
    result = await session.execute(stmt)
    return result.scalar_one()


async def count_active_orders_by_restaurant_id(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
) -> int:
    stmt = (
        select(func.count())
        .select_from(Order)
        .where(
            Order.restaurant_id == restaurant_id,
            Order.status.in_(
                [
                    OrderStatus.PENDING.value,
                    OrderStatus.ACCEPTED.value,
                ]
            ),
        )
    )
    result = await session.execute(stmt)
    return result.scalar_one()


async def update_order_status(
    session: AsyncSession, order: Order, new_status: OrderStatus
) -> Order:
    order.status = new_status.value
    if new_status == OrderStatus.READY:
        order.ready_at = datetime.now(timezone.utc)
    await session.flush()
    return order


async def create_order_event(
    session: AsyncSession,
    order_id: uuid.UUID,
    actor_id: uuid.UUID,
    actor_permissions: Sequence[Permission | str],
    old_status: OrderStatus,
    new_status: OrderStatus,
) -> OrderEvent:
    event = OrderEvent(
        order_id=order_id,
        actor_id=actor_id,
        actor_permissions=serialize_permissions(actor_permissions),
        old_status=old_status.value,
        new_status=new_status.value,
    )
    session.add(event)
    await session.flush()
    return event


async def get_events_by_order_id(session: AsyncSession, order_id: uuid.UUID) -> list[OrderEvent]:
    result = await session.execute(
        select(OrderEvent).where(OrderEvent.order_id == order_id).order_by(OrderEvent.created_at)
    )
    return list(result.scalars().all())


async def get_active_orders_for_display(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
) -> list[tuple[int, str]]:
    stmt = (
        select(Order.display_id, Order.status)
        .where(Order.restaurant_id == restaurant_id)
        .where(Order.status.notin_([OrderStatus.COMPLETED.value, OrderStatus.CANCELLED.value]))
        .order_by(Order.created_at.asc())
    )
    result = await session.execute(stmt)
    return list(result.tuples().all())
