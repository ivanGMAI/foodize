import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import Text, and_, cast, delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from features.admin.schemas import (
    AdminRestaurantResponse,
    AdminReviewResponse,
    AdvancedAnalytics,
    AnalyticsPoint,
    CohortPoint,
    FinanceAnalytics,
    FinanceSeriesPoint,
    FinanceTopItem,
    FinanceTopRestaurant,
    PlatformStats,
    StatsGrowthPoint,
)
from features.menu.models import MenuItem
from features.orders.models import Order, OrderItem
from features.restaurants.models import Restaurant
from features.reviews.models import Review
from features.users.models import User
from features.vendors.models import VendorProfile
from shared.enums.category import Category
from shared.enums.moderation_status import ModerationStatus
from shared.enums.order_status import OrderStatus
from shared.enums.permissions import Permission
from shared.enums.roles import UserRole
from shared.permissions import (
    VENDOR_PERMISSIONS,
    has_permission,
    permissions_with,
    permissions_without,
    serialize_permissions,
)

CATEGORY_RU = {
    Category.SHAURMA.value: "Шаурма",
    Category.BURGER.value: "Бургеры",
    Category.PIZZA.value: "Пицца",
    Category.SUSHI.value: "Суши и Роллы",
    Category.DRINK.value: "Напитки",
    Category.SNACK.value: "Снеки",
    Category.DESSERT.value: "Десерты",
    Category.SOUP.value: "Супы",
    Category.SALAD.value: "Салаты",
}

STATUS_RU = {
    OrderStatus.PENDING.value: "Ожидается",
    OrderStatus.ACCEPTED.value: "Принят",
    OrderStatus.READY.value: "Готово",
    OrderStatus.COMPLETED.value: "Завершен",
    OrderStatus.CANCELLED.value: "Отменен",
}


def _infer_role(permissions: list[str]) -> str:
    perm_set = set(permissions)
    if Permission.ADMIN_ACCESS.value in perm_set:
        return UserRole.ADMIN.value
    if Permission.RESTAURANTS_CREATE.value in perm_set:
        return UserRole.VENDOR.value
    if Permission.ORDERS_MANAGE_STATUS.value in perm_set:
        return UserRole.STAFF.value
    return UserRole.CUSTOMER.value


async def get_all_users(
    session: AsyncSession,
    role: str | None = None,
    search: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> list[User]:
    stmt = select(User).order_by(User.created_at.desc())
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            (User.name.ilike(pattern))
            | (User.phone_number.ilike(pattern))
            | (User.first_name.ilike(pattern))
            | (User.last_name.ilike(pattern))
        )
    result = await session.execute(stmt)
    users = list(result.scalars().all())
    if role is not None:
        users = [u for u in users if _infer_role(u.permissions or []) == role]
    return users[offset : offset + limit]


async def count_all_users(
    session: AsyncSession,
    role: str | None = None,
    search: str | None = None,
) -> int:
    if role is None:
        stmt = select(func.count()).select_from(User)
        if search:
            pattern = f"%{search}%"
            stmt = stmt.where(
                (User.name.ilike(pattern))
                | (User.phone_number.ilike(pattern))
                | (User.first_name.ilike(pattern))
                | (User.last_name.ilike(pattern))
            )
        result = await session.execute(stmt)
        return result.scalar_one()

    user_stmt = select(User)
    if search:
        pattern = f"%{search}%"
        user_stmt = user_stmt.where(
            (User.name.ilike(pattern))
            | (User.phone_number.ilike(pattern))
            | (User.first_name.ilike(pattern))
            | (User.last_name.ilike(pattern))
        )
    user_result = await session.execute(user_stmt)
    users = user_result.scalars().all()
    return len([u for u in users if _infer_role(u.permissions or []) == role])


async def get_user_by_id(session: AsyncSession, user_id: uuid.UUID) -> User | None:
    result = await session.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def deactivate_user(session: AsyncSession, user: User) -> User:
    user.is_active = False
    await session.commit()
    await session.refresh(user)
    return user


async def activate_user(session: AsyncSession, user: User) -> User:
    user.is_active = True
    await session.commit()
    await session.refresh(user)
    return user


async def get_all_orders(
    session: AsyncSession,
    status: OrderStatus | None = None,
    restaurant_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    offset: int = 0,
    limit: int = 20,
) -> list[Order]:
    stmt = (
        select(Order)
        .join(User, User.id == Order.user_id)
        .join(Restaurant, Restaurant.id == Order.restaurant_id)
        .options(
            selectinload(Order.items).selectinload(OrderItem.menu_item),
            selectinload(Order.items).selectinload(OrderItem.selected_options),
            selectinload(Order.user),
            selectinload(Order.restaurant),
        )
        .order_by(Order.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    if status is not None:
        stmt = stmt.where(Order.status == status.value)
    if restaurant_id is not None:
        stmt = stmt.where(Order.restaurant_id == restaurant_id)
    if user_id is not None:
        stmt = stmt.where(Order.user_id == user_id)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            (User.name.ilike(pattern))
            | (User.phone_number.ilike(pattern))
            | (Restaurant.name.ilike(pattern))
        )
    if date_from is not None:
        stmt = stmt.where(Order.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to is not None:
        stmt = stmt.where(
            Order.created_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time())
        )
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def count_all_orders(
    session: AsyncSession,
    status: OrderStatus | None = None,
    restaurant_id: uuid.UUID | None = None,
    user_id: uuid.UUID | None = None,
    search: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> int:
    stmt = (
        select(func.count())
        .select_from(Order)
        .join(User, User.id == Order.user_id)
        .join(Restaurant, Restaurant.id == Order.restaurant_id)
    )
    if status is not None:
        stmt = stmt.where(Order.status == status.value)
    if restaurant_id is not None:
        stmt = stmt.where(Order.restaurant_id == restaurant_id)
    if user_id is not None:
        stmt = stmt.where(Order.user_id == user_id)
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where(
            (User.name.ilike(pattern))
            | (User.phone_number.ilike(pattern))
            | (Restaurant.name.ilike(pattern))
        )
    if date_from is not None:
        stmt = stmt.where(Order.created_at >= datetime.combine(date_from, datetime.min.time()))
    if date_to is not None:
        stmt = stmt.where(
            Order.created_at < datetime.combine(date_to + timedelta(days=1), datetime.min.time())
        )
    result = await session.execute(stmt)
    return result.scalar_one()


async def get_all_restaurants(
    session: AsyncSession,
    search: str | None = None,
    vendor_search: str | None = None,
    is_open: bool | None = None,
    moderation_status: str | None = None,
    min_rating: float | None = None,
    offset: int = 0,
    limit: int = 20,
) -> list[AdminRestaurantResponse]:
    avg_rating = func.coalesce(func.avg(Review.rating), 0)
    stmt = (
        select(
            Restaurant,
            User.name.label("vendor_name"),
            User.phone_number.label("vendor_phone"),
            avg_rating.label("average_rating"),
            func.count(func.distinct(Review.id)).label("review_count"),
            func.count(func.distinct(Order.id)).label("orders_count"),
        )
        .join(VendorProfile, VendorProfile.id == Restaurant.vendor_id)
        .join(User, User.id == VendorProfile.user_id)
        .outerjoin(
            Review,
            and_(Review.restaurant_id == Restaurant.id, Review.deleted_at.is_(None)),
        )
        .outerjoin(Order, Order.restaurant_id == Restaurant.id)
        .where(Restaurant.is_active.is_(True))
        .group_by(Restaurant.id, User.name, User.phone_number)
        .order_by(Restaurant.created_at.desc())
    )
    if search:
        stmt = stmt.where(Restaurant.name.ilike(f"%{search}%"))
    if vendor_search:
        pattern = f"%{vendor_search}%"
        stmt = stmt.where((User.name.ilike(pattern)) | (User.phone_number.ilike(pattern)))
    if is_open is not None:
        stmt = stmt.where(Restaurant.is_open == is_open)
    if moderation_status:
        stmt = stmt.where(Restaurant.moderation_status == moderation_status)
    if min_rating is not None:
        stmt = stmt.having(avg_rating >= min_rating)
    stmt = stmt.offset(offset).limit(limit)
    result = await session.execute(stmt)
    return [
        AdminRestaurantResponse(
            id=row[0].id,
            display_id=row[0].display_id,
            name=row[0].name,
            address=row[0].address,
            vendor_id=row[0].vendor_id,
            vendor_name=row[1],
            vendor_phone=row[2],
            is_hiring=row[0].is_hiring,
            is_open=row[0].is_open,
            is_active=row[0].is_active,
            photo_url=row[0].photo_url,
            average_rating=round(float(row[3]), 1),
            review_count=row[4],
            orders_count=row[5],
            moderation_status=row[0].moderation_status,
            rejection_reason=row[0].rejection_reason,
            created_at=row[0].created_at,
        )
        for row in result.all()
    ]


async def count_all_restaurants(
    session: AsyncSession,
    search: str | None = None,
    vendor_search: str | None = None,
    is_open: bool | None = None,
    moderation_status: str | None = None,
    min_rating: float | None = None,
) -> int:
    avg_rating = func.coalesce(func.avg(Review.rating), 0)
    stmt = (
        select(Restaurant.id)
        .join(VendorProfile, VendorProfile.id == Restaurant.vendor_id)
        .join(User, User.id == VendorProfile.user_id)
        .outerjoin(
            Review,
            and_(Review.restaurant_id == Restaurant.id, Review.deleted_at.is_(None)),
        )
        .where(Restaurant.is_active.is_(True))
        .group_by(Restaurant.id, User.name, User.phone_number)
    )

    if search:
        stmt = stmt.where(Restaurant.name.ilike(f"%{search}%"))
    if vendor_search:
        pattern = f"%{vendor_search}%"
        stmt = stmt.where((User.name.ilike(pattern)) | (User.phone_number.ilike(pattern)))
    if is_open is not None:
        stmt = stmt.where(Restaurant.is_open == is_open)
    if moderation_status:
        stmt = stmt.where(Restaurant.moderation_status == moderation_status)
    if min_rating is not None:
        stmt = stmt.having(avg_rating >= min_rating)

    count_stmt = select(func.count()).select_from(stmt.subquery())
    result = await session.execute(count_stmt)
    return result.scalar_one()


async def get_restaurant_by_id(
    session: AsyncSession, restaurant_id: uuid.UUID
) -> AdminRestaurantResponse | None:
    stmt = (
        select(
            Restaurant,
            User.name.label("vendor_name"),
            User.phone_number.label("vendor_phone"),
            func.coalesce(func.avg(Review.rating), 0).label("average_rating"),
            func.count(func.distinct(Review.id)).label("review_count"),
            func.count(func.distinct(Order.id)).label("orders_count"),
        )
        .join(VendorProfile, VendorProfile.id == Restaurant.vendor_id)
        .join(User, User.id == VendorProfile.user_id)
        .outerjoin(
            Review,
            and_(Review.restaurant_id == Restaurant.id, Review.deleted_at.is_(None)),
        )
        .outerjoin(Order, Order.restaurant_id == Restaurant.id)
        .where(Restaurant.id == restaurant_id, Restaurant.is_active.is_(True))
        .group_by(Restaurant.id, User.name, User.phone_number)
    )
    row = (await session.execute(stmt)).one_or_none()
    if not row:
        return None
    restaurant = row[0]
    return AdminRestaurantResponse(
        id=restaurant.id,
        display_id=restaurant.display_id,
        name=restaurant.name,
        address=restaurant.address,
        vendor_id=restaurant.vendor_id,
        vendor_name=row[1],
        vendor_phone=row[2],
        is_hiring=restaurant.is_hiring,
        is_open=restaurant.is_open,
        is_active=restaurant.is_active,
        photo_url=restaurant.photo_url,
        average_rating=round(float(row[3]), 1),
        review_count=row[4],
        orders_count=row[5],
        moderation_status=restaurant.moderation_status,
        rejection_reason=restaurant.rejection_reason,
        created_at=restaurant.created_at,
    )


async def get_all_vendors(
    session: AsyncSession,
    search: str | None = None,
    approval_status: str | None = None,
    offset: int = 0,
    limit: int = 20,
) -> list[VendorProfile]:
    stmt = (
        select(VendorProfile)
        .join(User, User.id == VendorProfile.user_id)
        .options(selectinload(VendorProfile.user), selectinload(VendorProfile.restaurants))
        .order_by(VendorProfile.created_at.desc())
    )
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where((User.name.ilike(pattern)) | (User.phone_number.ilike(pattern)))
    if approval_status:
        stmt = stmt.where(VendorProfile.approval_status == approval_status)
    result = await session.execute(stmt.offset(offset).limit(limit))
    return list(result.scalars().all())


async def count_all_vendors(
    session: AsyncSession,
    search: str | None = None,
    approval_status: str | None = None,
) -> int:
    stmt = (
        select(func.count()).select_from(VendorProfile).join(User, User.id == VendorProfile.user_id)
    )
    if search:
        pattern = f"%{search}%"
        stmt = stmt.where((User.name.ilike(pattern)) | (User.phone_number.ilike(pattern)))
    if approval_status:
        stmt = stmt.where(VendorProfile.approval_status == approval_status)
    result = await session.execute(stmt)
    return result.scalar_one()


async def get_vendor_by_id(session: AsyncSession, vendor_id: uuid.UUID) -> VendorProfile | None:
    result = await session.execute(
        select(VendorProfile)
        .join(User, User.id == VendorProfile.user_id)
        .where(VendorProfile.id == vendor_id)
        .options(selectinload(VendorProfile.user), selectinload(VendorProfile.restaurants))
    )
    return result.scalar_one_or_none()


async def deactivate_restaurant(
    session: AsyncSession, restaurant_id: uuid.UUID
) -> Restaurant | None:
    restaurant = await session.get(Restaurant, restaurant_id)
    if not restaurant:
        return None
    restaurant.is_active = False
    restaurant.is_open = False
    restaurant.is_hiring = False
    await session.commit()
    await session.refresh(restaurant)
    return restaurant


async def deactivate_vendor(session: AsyncSession, vendor: VendorProfile) -> VendorProfile:
    if not has_permission(vendor.user.permissions, Permission.ADMIN_ACCESS):
        vendor.user.permissions = permissions_without(vendor.user.permissions, VENDOR_PERMISSIONS)
    for restaurant in vendor.restaurants or []:
        restaurant.is_active = False
        restaurant.is_open = False
        restaurant.is_hiring = False
    await session.commit()
    await session.refresh(vendor)
    return vendor


async def set_vendor_moderation(
    session: AsyncSession,
    vendor: VendorProfile,
    status: str,
    reason: str | None = None,
) -> VendorProfile:
    vendor.approval_status = status
    vendor.rejection_reason = reason if status == ModerationStatus.REJECTED.value else None
    if status == ModerationStatus.APPROVED.value:
        if not has_permission(vendor.user.permissions, Permission.ADMIN_ACCESS):
            vendor.user.permissions = permissions_with(vendor.user.permissions, VENDOR_PERMISSIONS)
        for restaurant in vendor.restaurants or []:
            restaurant.moderation_status = ModerationStatus.APPROVED.value
            restaurant.rejection_reason = None
    await session.commit()
    await session.refresh(vendor)
    return vendor


async def set_restaurant_moderation(
    session: AsyncSession,
    restaurant: Restaurant,
    status: str,
    reason: str | None = None,
) -> Restaurant:
    restaurant.moderation_status = status
    restaurant.rejection_reason = reason if status == ModerationStatus.REJECTED.value else None
    await session.commit()
    await session.refresh(restaurant)
    return restaurant


async def get_all_reviews(
    session: AsyncSession,
    rating: int | None = None,
    offset: int = 0,
    limit: int = 20,
) -> list[AdminReviewResponse]:
    stmt = (
        select(
            Review,
            User.name.label("user_name"),
            User.phone_number.label("user_phone"),
            Restaurant.name.label("restaurant_name"),
        )
        .join(User, User.id == Review.user_id)
        .join(Restaurant, Restaurant.id == Review.restaurant_id)
        .where(Review.deleted_at.is_(None))
        .order_by(Review.created_at.desc())
    )
    if rating is not None:
        stmt = stmt.where(Review.rating == rating)
    stmt = stmt.offset(offset).limit(limit)
    result = await session.execute(stmt)
    return [
        AdminReviewResponse(
            id=row[0].id,
            user_id=row[0].user_id,
            user_name=row[1],
            user_phone=row[2],
            restaurant_id=row[0].restaurant_id,
            restaurant_name=row[3],
            rating=row[0].rating,
            text=row[0].text,
            is_verified_purchase=row[0].is_verified_purchase,
            created_at=row[0].created_at,
        )
        for row in result.all()
    ]


async def count_all_reviews(session: AsyncSession, rating: int | None = None) -> int:
    stmt = select(func.count()).select_from(Review).where(Review.deleted_at.is_(None))
    if rating is not None:
        stmt = stmt.where(Review.rating == rating)
    result = await session.execute(stmt)
    return result.scalar_one()


async def get_review_by_id(session: AsyncSession, review_id: uuid.UUID) -> Review | None:
    result = await session.execute(
        select(Review).where(Review.id == review_id, Review.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def delete_review(session: AsyncSession, review: Review) -> Review:
    review.deleted_at = datetime.now(UTC)
    await session.commit()
    await session.refresh(review)
    return review


async def batch_deactivate_users(session: AsyncSession, ids: list[uuid.UUID]) -> int:
    result = await session.execute(update(User).where(User.id.in_(ids)).values(is_active=False))
    return result.rowcount  # type: ignore[attr-defined]


async def batch_activate_users(session: AsyncSession, ids: list[uuid.UUID]) -> int:
    result = await session.execute(update(User).where(User.id.in_(ids)).values(is_active=True))
    return result.rowcount  # type: ignore[attr-defined]


async def batch_delete_reviews(session: AsyncSession, ids: list[uuid.UUID]) -> int:
    result = await session.execute(delete(Review).where(Review.id.in_(ids)))
    return result.rowcount  # type: ignore[attr-defined]


async def _count_by_day(
    session: AsyncSession,
    created_at_column,
    start_date: date,
) -> dict[date, int]:
    result = await session.execute(
        select(func.date(created_at_column), func.count())
        .where(created_at_column >= datetime.combine(start_date, datetime.min.time(), tzinfo=UTC))
        .group_by(func.date(created_at_column))
        .order_by(func.date(created_at_column))
    )
    counts: dict[date, int] = {}
    for day, count in result.all():
        if isinstance(day, str):
            day = date.fromisoformat(day)
        counts[day] = count
    return counts


def _growth_points(counts: dict[date, int], start_date: date, days: int) -> list[StatsGrowthPoint]:
    return [
        StatsGrowthPoint(
            date=start_date + timedelta(days=index),
            count=counts.get(start_date + timedelta(days=index), 0),
        )
        for index in range(days)
    ]


def _finance_points(
    counts: dict[date, int], start_date: date, days: int
) -> list[FinanceSeriesPoint]:
    return [
        FinanceSeriesPoint(
            date=start_date + timedelta(days=index),
            value=counts.get(start_date + timedelta(days=index), 0),
        )
        for index in range(days)
    ]


async def get_finance_analytics(
    session: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
    vendor_id: uuid.UUID | None = None,
    restaurant_id: uuid.UUID | None = None,
) -> FinanceAnalytics:
    end_date = date_to or datetime.now(UTC).date()
    start_date = date_from or (end_date - timedelta(days=13))

    order_filters = [
        Order.created_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=UTC),
        Order.created_at
        < datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=UTC),
    ]
    if vendor_id is not None:
        order_filters.append(Restaurant.vendor_id == vendor_id)
    if restaurant_id is not None:
        order_filters.append(Order.restaurant_id == restaurant_id)

    revenue_rows = await session.execute(
        select(func.date(Order.created_at), func.coalesce(func.sum(Order.total_price), 0))
        .join(Restaurant, Restaurant.id == Order.restaurant_id)
        .where(*order_filters, Order.status == OrderStatus.COMPLETED.value)
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
    )
    revenue_counts: dict[date, int] = {}
    for day, value in revenue_rows.all():
        if isinstance(day, str):
            day = date.fromisoformat(day)
        elif isinstance(day, datetime):
            day = day.date()
        revenue_counts[day] = int(value or 0)

    totals = await session.execute(
        select(
            func.count(Order.id),
            func.count().filter(Order.status == OrderStatus.COMPLETED.value),
            func.count().filter(Order.status == OrderStatus.CANCELLED.value),
            func.coalesce(
                func.avg(Order.total_price).filter(Order.status == OrderStatus.COMPLETED.value),
                0,
            ),
        )
        .select_from(Order)
        .join(Restaurant, Restaurant.id == Order.restaurant_id)
        .where(*order_filters)
    )
    total_orders, completed_orders, cancelled_orders, average_check = totals.one()

    top_restaurant_rows = await session.execute(
        select(
            Restaurant.id,
            Restaurant.name,
            func.coalesce(func.sum(Order.total_price), 0).label("revenue"),
            func.count(Order.id).label("orders_count"),
        )
        .join(Order, Order.restaurant_id == Restaurant.id)
        .where(*order_filters, Order.status == OrderStatus.COMPLETED.value)
        .group_by(Restaurant.id, Restaurant.name)
        .order_by(func.coalesce(func.sum(Order.total_price), 0).desc())
        .limit(5)
    )

    top_item_rows = await session.execute(
        select(
            MenuItem.id,
            MenuItem.name,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("quantity"),
            func.coalesce(func.sum(OrderItem.quantity * OrderItem.price_at_purchase), 0).label(
                "revenue"
            ),
        )
        .join(OrderItem, OrderItem.menu_item_id == MenuItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Restaurant, Restaurant.id == Order.restaurant_id)
        .where(*order_filters, Order.status == OrderStatus.COMPLETED.value)
        .group_by(MenuItem.id, MenuItem.name)
        .order_by(func.coalesce(func.sum(OrderItem.quantity), 0).desc())
        .limit(5)
    )

    conversion = round((completed_orders / total_orders) * 100, 1) if total_orders else 0.0
    days = (end_date - start_date).days + 1
    total_revenue = sum(revenue_counts.values())

    prev_end = start_date - timedelta(days=1)
    prev_start = prev_end - timedelta(days=days - 1)
    prev_filters = [
        Order.created_at >= datetime.combine(prev_start, datetime.min.time(), tzinfo=UTC),
        Order.created_at
        < datetime.combine(prev_end + timedelta(days=1), datetime.min.time(), tzinfo=UTC),
        Order.status == OrderStatus.COMPLETED.value,
    ]
    if vendor_id is not None:
        prev_filters.append(Restaurant.vendor_id == vendor_id)
    if restaurant_id is not None:
        prev_filters.append(Order.restaurant_id == restaurant_id)

    prev_row = await session.execute(
        select(func.coalesce(func.sum(Order.total_price), 0))
        .join(Restaurant, Restaurant.id == Order.restaurant_id)
        .where(*prev_filters)
    )
    prev_revenue = int(prev_row.scalar_one())

    if prev_revenue > 0:
        revenue_growth_pct: float | None = round(
            (total_revenue - prev_revenue) / prev_revenue * 100, 1
        )
    elif total_revenue > 0:
        revenue_growth_pct = 100.0
    else:
        revenue_growth_pct = None

    return FinanceAnalytics(
        revenue_by_day=_finance_points(revenue_counts, start_date, days),
        average_check=round(float(average_check or 0), 1),
        top_restaurants=[
            FinanceTopRestaurant(
                restaurant_id=row[0],
                name=row[1],
                revenue=int(row[2] or 0),
                orders_count=row[3],
            )
            for row in top_restaurant_rows.all()
        ],
        top_items=[
            FinanceTopItem(
                menu_item_id=row[0],
                name=row[1],
                quantity=int(row[2] or 0),
                revenue=int(row[3] or 0),
            )
            for row in top_item_rows.all()
        ],
        cancelled_orders=cancelled_orders,
        total_orders=total_orders,
        completed_orders=completed_orders,
        conversion_percent=conversion,
        total_revenue=total_revenue,
        revenue_growth_pct=revenue_growth_pct,
    )


async def get_platform_stats(session: AsyncSession) -> PlatformStats:
    users_result = await session.execute(select(User.permissions))
    users_by_permission: dict[str, int] = {}
    users_by_role: dict[str, int] = {
        UserRole.CUSTOMER.value: 0,
        UserRole.VENDOR.value: 0,
        UserRole.STAFF.value: 0,
        UserRole.ADMIN.value: 0,
    }
    for permissions in users_result.scalars().all():
        perm_set = set(serialize_permissions(permissions))
        for permission in perm_set:
            users_by_permission[permission] = users_by_permission.get(permission, 0) + 1
        if Permission.ADMIN_ACCESS.value in perm_set:
            users_by_role[UserRole.ADMIN.value] += 1
        elif Permission.RESTAURANTS_CREATE.value in perm_set:
            users_by_role[UserRole.VENDOR.value] += 1
        elif Permission.ORDERS_MANAGE_STATUS.value in perm_set:
            users_by_role[UserRole.STAFF.value] += 1
        else:
            users_by_role[UserRole.CUSTOMER.value] += 1

    orders_by_status_rows = await session.execute(
        select(Order.status, func.count()).group_by(Order.status)
    )
    orders_by_status = {row[0]: row[1] for row in orders_by_status_rows.all()}

    total_restaurants_result = await session.execute(
        select(func.count()).select_from(Restaurant).where(Restaurant.is_active.is_(True))
    )
    total_restaurants = total_restaurants_result.scalar_one()

    total_vendors_result = await session.execute(
        select(func.count())
        .select_from(VendorProfile)
        .where(VendorProfile.approval_status == ModerationStatus.APPROVED.value)
    )
    total_vendors = total_vendors_result.scalar_one()

    days = 14
    start_date = datetime.now(UTC).date() - timedelta(days=days - 1)
    users_growth_result = await session.execute(
        select(func.date(User.created_at), func.count())
        .where(User.created_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=UTC))
        .where(~cast(User.permissions, Text).like('%"admin.access"%'))
        .group_by(func.date(User.created_at))
        .order_by(func.date(User.created_at))
    )
    users_growth: dict[date, int] = {}
    for day, count in users_growth_result.all():
        if isinstance(day, str):
            day = date.fromisoformat(day)
        users_growth[day] = count
    restaurants_growth = await _count_by_day(session, Restaurant.created_at, start_date)
    orders_growth = await _count_by_day(session, Order.created_at, start_date)
    vendors_growth = await _count_by_day(session, VendorProfile.created_at, start_date)

    return PlatformStats(
        users_by_permission=users_by_permission,
        users_by_role=users_by_role,
        total_users=users_by_role[UserRole.CUSTOMER.value]
        + users_by_role[UserRole.STAFF.value]
        + users_by_role[UserRole.VENDOR.value],
        orders_by_status=orders_by_status,
        total_restaurants=total_restaurants,
        total_vendors=total_vendors,
        growth={
            "users": _growth_points(users_growth, start_date, days),
            "restaurants": _growth_points(restaurants_growth, start_date, days),
            "orders": _growth_points(orders_growth, start_date, days),
            "vendors": _growth_points(vendors_growth, start_date, days),
        },
    )


async def get_advanced_analytics(
    session: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
    restaurant_id: uuid.UUID | None = None,
    vendor_id: uuid.UUID | None = None,
) -> AdvancedAnalytics:
    end_date = date_to or datetime.now(UTC).date()
    start_date = date_from or (end_date - timedelta(days=29))

    filters = [
        Order.created_at >= datetime.combine(start_date, datetime.min.time(), tzinfo=UTC),
        Order.created_at
        < datetime.combine(end_date + timedelta(days=1), datetime.min.time(), tzinfo=UTC),
        Order.status == OrderStatus.COMPLETED.value,
    ]
    if restaurant_id:
        filters.append(Order.restaurant_id == restaurant_id)
    if vendor_id:
        filters.append(Restaurant.vendor_id == vendor_id)

    hourly_rows = await session.execute(
        select(func.extract("hour", Order.created_at).label("hour"), func.count(Order.id))
        .join(Restaurant, Restaurant.id == Order.restaurant_id)
        .where(*filters)
        .group_by("hour")
        .order_by("hour")
    )
    hourly_load = [
        AnalyticsPoint(label=f"{int(row[0]):02d}:00", value=row[1]) for row in hourly_rows.all()
    ]

    category_rows = await session.execute(
        select(
            MenuItem.category,
            func.sum(OrderItem.quantity * OrderItem.price_at_purchase),
        )
        .join(OrderItem, OrderItem.menu_item_id == MenuItem.id)
        .join(Order, Order.id == OrderItem.order_id)
        .join(Restaurant, Restaurant.id == Order.restaurant_id)
        .where(*filters)
        .group_by(MenuItem.category)
    )
    category_revenue = [
        AnalyticsPoint(
            label=CATEGORY_RU.get(row[0], row[0] or "Без категории"), value=int(row[1] or 0)
        )
        for row in category_rows.all()
    ]

    aov_rows = await session.execute(
        select(func.date(Order.created_at), func.avg(Order.total_price))
        .join(Restaurant, Restaurant.id == Order.restaurant_id)
        .where(*filters)
        .group_by(func.date(Order.created_at))
        .order_by(func.date(Order.created_at))
    )

    def _parse_day(d):
        if isinstance(d, str):
            return date.fromisoformat(d)
        if isinstance(d, datetime):
            return d.date()
        return d

    aov_counts = {_parse_day(row[0]): int(row[1] or 0) for row in aov_rows.all()}
    days_count = (end_date - start_date).days + 1
    aov_dynamics = _finance_points(aov_counts, start_date, days_count)

    retention: list[CohortPoint] = []

    return AdvancedAnalytics(
        hourly_load=hourly_load,
        category_revenue=category_revenue,
        aov_dynamics=aov_dynamics,
        retention=retention,
    )
