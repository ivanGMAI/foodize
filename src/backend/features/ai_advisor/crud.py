"""Vendor-scoped queries that complement the existing analytics in
``features/admin/crud.py`` for the AI advisor.

Everything here filters by ``vendor_id`` so the advisor can only ever see the
calling vendor's own data.
"""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from features.menu.models import MenuItem
from features.orders.models import Order, OrderItem
from features.restaurants.models import Restaurant
from features.reviews.models import Review
from shared.enums.order_status import OrderStatus


def _day_bounds(start_date: date, end_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(start_date, datetime.min.time(), tzinfo=UTC)
    end = datetime.combine(end_date, datetime.max.time(), tzinfo=UTC)
    return start, end


async def get_bottom_items(
    session: AsyncSession,
    *,
    vendor_id: uuid.UUID,
    start_date: date,
    end_date: date,
    restaurant_id: uuid.UUID | None = None,
    limit: int = 10,
) -> list[dict]:
    """Least-sold (incl. never-sold) available menu items in the period."""

    start, end = _day_bounds(start_date, end_date)
    sold = case(
        (
            and_(
                Order.id.isnot(None),
                Order.status == OrderStatus.COMPLETED.value,
                Order.created_at >= start,
                Order.created_at <= end,
            ),
            OrderItem.quantity,
        ),
        else_=0,
    )

    filters = [Restaurant.vendor_id == vendor_id, MenuItem.is_deleted.is_(False)]
    if restaurant_id is not None:
        filters.append(MenuItem.restaurant_id == restaurant_id)

    stmt = (
        select(
            MenuItem.name,
            MenuItem.category,
            MenuItem.price,
            MenuItem.is_available,
            func.coalesce(func.sum(sold), 0).label("sold_qty"),
        )
        .select_from(MenuItem)
        .join(Restaurant, Restaurant.id == MenuItem.restaurant_id)
        .outerjoin(OrderItem, OrderItem.menu_item_id == MenuItem.id)
        .outerjoin(Order, Order.id == OrderItem.order_id)
        .where(*filters)
        .group_by(
            MenuItem.id,
            MenuItem.name,
            MenuItem.category,
            MenuItem.price,
            MenuItem.is_available,
        )
        .order_by(func.coalesce(func.sum(sold), 0).asc(), MenuItem.name.asc())
        .limit(limit)
    )
    rows = await session.execute(stmt)
    return [
        {
            "name": name,
            "category": category,
            "price": price,
            "is_available": is_available,
            "sold_qty": int(sold_qty or 0),
        }
        for name, category, price, is_available, sold_qty in rows.all()
    ]


async def get_menu_overview(
    session: AsyncSession,
    *,
    vendor_id: uuid.UUID,
    restaurant_id: uuid.UUID | None = None,
    limit: int = 100,
) -> list[dict]:
    filters = [Restaurant.vendor_id == vendor_id, MenuItem.is_deleted.is_(False)]
    if restaurant_id is not None:
        filters.append(MenuItem.restaurant_id == restaurant_id)

    stmt = (
        select(
            Restaurant.name,
            MenuItem.name,
            MenuItem.category,
            MenuItem.price,
            MenuItem.is_available,
        )
        .join(Restaurant, Restaurant.id == MenuItem.restaurant_id)
        .where(*filters)
        .order_by(Restaurant.name.asc(), MenuItem.category.asc(), MenuItem.name.asc())
        .limit(limit)
    )
    rows = await session.execute(stmt)
    return [
        {
            "restaurant": restaurant,
            "name": item_name,
            "category": category,
            "price": price,
            "is_available": is_available,
        }
        for restaurant, item_name, category, price, is_available in rows.all()
    ]


async def get_reviews_summary(
    session: AsyncSession,
    *,
    vendor_id: uuid.UUID,
    restaurant_id: uuid.UUID | None = None,
    recent_limit: int = 5,
) -> dict:
    filters = [Restaurant.vendor_id == vendor_id]
    if restaurant_id is not None:
        filters.append(Review.restaurant_id == restaurant_id)

    totals = await session.execute(
        select(func.coalesce(func.avg(Review.rating), 0), func.count(Review.id))
        .join(Restaurant, Restaurant.id == Review.restaurant_id)
        .where(*filters)
    )
    avg_rating, review_count = totals.one()

    dist_rows = await session.execute(
        select(Review.rating, func.count(Review.id))
        .join(Restaurant, Restaurant.id == Review.restaurant_id)
        .where(*filters)
        .group_by(Review.rating)
    )
    distribution = {int(rating): int(count) for rating, count in dist_rows.all()}

    recent_rows = await session.execute(
        select(Review.rating, Review.text)
        .join(Restaurant, Restaurant.id == Review.restaurant_id)
        .where(*filters, Review.text.isnot(None))
        .order_by(Review.created_at.desc())
        .limit(recent_limit)
    )
    recent = [{"rating": int(rating), "text": text} for rating, text in recent_rows.all()]

    return {
        "average_rating": round(float(avg_rating or 0), 2),
        "review_count": int(review_count or 0),
        "distribution": distribution,
        "recent": recent,
    }
