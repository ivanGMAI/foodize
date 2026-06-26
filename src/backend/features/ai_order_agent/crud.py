"""Menu search for the customer order agent.

Keyword search over publicly orderable menu items. Step 6 replaces/augments
this with vector (embedding) search + reranking for the RAG claim.
"""

import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from features.menu.models import MenuItem
from features.restaurants.models import Restaurant
from shared.enums.moderation_status import ModerationStatus


def _orderable_filters(max_price: int | None, restaurant_id: uuid.UUID | None) -> list:
    filters = [
        MenuItem.is_available.is_(True),
        MenuItem.is_deleted.is_(False),
        Restaurant.is_active.is_(True),
        Restaurant.moderation_status == ModerationStatus.APPROVED.value,
    ]
    if max_price is not None:
        filters.append(MenuItem.price <= max_price)
    if restaurant_id is not None:
        filters.append(MenuItem.restaurant_id == restaurant_id)
    return filters


def _row_to_dict(row) -> dict:
    return {
        "menu_item_id": str(row.id),
        "name": row.name,
        "description": row.description,
        "price": row.price,
        "category": row.category,
        "restaurant_id": str(row.restaurant_id),
        "restaurant_name": row.restaurant_name,
        "restaurant_address": row.restaurant_address,
    }


_SELECT_COLUMNS = (
    MenuItem.id,
    MenuItem.name,
    MenuItem.description,
    MenuItem.price,
    MenuItem.category,
    MenuItem.restaurant_id,
    Restaurant.name.label("restaurant_name"),
    Restaurant.address.label("restaurant_address"),
)


async def list_orderable_items(
    session: AsyncSession,
    *,
    max_price: int | None = None,
    restaurant_id: uuid.UUID | None = None,
    limit: int = 300,
) -> list[dict]:
    """Candidate pool for semantic search — no text filter, freshest first."""
    stmt = (
        select(*_SELECT_COLUMNS)
        .join(Restaurant, Restaurant.id == MenuItem.restaurant_id)
        .where(*_orderable_filters(max_price, restaurant_id))
        .order_by(MenuItem.created_at.desc())
        .limit(limit)
    )
    rows = await session.execute(stmt)
    return [_row_to_dict(row) for row in rows.all()]


async def search_menu_items(
    session: AsyncSession,
    *,
    query: str | None = None,
    max_price: int | None = None,
    restaurant_id: uuid.UUID | None = None,
    limit: int = 15,
) -> list[dict]:
    filters = _orderable_filters(max_price, restaurant_id)
    if query:
        pattern = f"%{query.strip()}%"
        filters.append(or_(MenuItem.name.ilike(pattern), MenuItem.description.ilike(pattern)))

    stmt = (
        select(*_SELECT_COLUMNS)
        .join(Restaurant, Restaurant.id == MenuItem.restaurant_id)
        .where(*filters)
        .order_by(MenuItem.price.asc(), MenuItem.name.asc())
        .limit(limit)
    )
    rows = await session.execute(stmt)
    return [_row_to_dict(row) for row in rows.all()]
