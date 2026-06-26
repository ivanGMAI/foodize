import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from features.admin import crud as admin_crud
from features.admin.crud import CATEGORY_RU, STATUS_RU
from features.admin.export import _build_analytics_pdf, _build_finance_pdf, _make_csv
from features.menu.crud import get_menu_items
from features.menu.models import MenuItem
from features.promos.crud import get_promos_by_restaurant_ids
from features.vendors.models import VendorProfile
from shared.enums.order_status import OrderStatus


async def export_orders_csv(
    session: AsyncSession,
    vendor: VendorProfile,
    date_from: date | None = None,
    date_to: date | None = None,
    status: OrderStatus | None = None,
    restaurant_id: uuid.UUID | None = None,
) -> bytes:
    orders = await admin_crud.get_all_orders(
        session,
        status=status,
        date_from=date_from,
        date_to=date_to,
        offset=0,
        limit=1_000_000,
    )
    vendor_restaurant_ids = {r.id for r in (vendor.restaurants or [])}
    if restaurant_id:
        vendor_restaurant_ids = {restaurant_id} & vendor_restaurant_ids
    orders = [o for o in orders if o.restaurant_id in vendor_restaurant_ids]

    headers = [
        "ID",
        "Номер",
        "Клиент",
        "Ресторан",
        "Статус",
        "Позиций",
        "Сумма (₽)",
        "Дата создания",
    ]
    rows = [
        [
            str(o.id),
            getattr(o, "display_id", None) or str(o.id)[:8],
            o.user.name if o.user else "",
            o.restaurant.name if o.restaurant else "",
            STATUS_RU.get(o.status, o.status),
            len(o.items or []),
            o.total_price,
            o.created_at.strftime("%Y-%m-%d %H:%M"),
        ]
        for o in orders
    ]
    return _make_csv(headers, rows)


async def export_menu_csv(
    session: AsyncSession,
    vendor: VendorProfile,
    restaurant_id: uuid.UUID | None = None,
) -> bytes:
    vendor_restaurant_ids = [r.id for r in (vendor.restaurants or [])]
    if restaurant_id and restaurant_id in vendor_restaurant_ids:
        restaurant_ids = [restaurant_id]
    else:
        restaurant_ids = vendor_restaurant_ids

    all_items: list[MenuItem] = []
    for rid in restaurant_ids:
        items = await get_menu_items(session, rid, limit=10_000)
        all_items.extend(items)

    headers = ["ID", "Название", "Категория", "Цена (₽)", "Доступно", "Ресторан ID"]
    rows = [
        [
            str(item.id),
            item.name,
            CATEGORY_RU.get(item.category, item.category or ""),
            item.price,
            "Да" if item.is_available else "Нет",
            str(item.restaurant_id),
        ]
        for item in all_items
        if not item.is_deleted
    ]
    return _make_csv(headers, rows)


async def export_promos_csv(
    session: AsyncSession,
    vendor: VendorProfile,
    restaurant_id: uuid.UUID | None = None,
) -> bytes:
    vendor_restaurant_ids = [r.id for r in (vendor.restaurants or [])]
    if restaurant_id and restaurant_id in vendor_restaurant_ids:
        target_ids = [restaurant_id]
    else:
        target_ids = vendor_restaurant_ids

    promos = await get_promos_by_restaurant_ids(session, target_ids, offset=0, limit=1_000_000)

    headers = [
        "Код",
        "Тип скидки",
        "Значение",
        "Макс. использований",
        "Использовано",
        "Активен",
        "Дата создания",
    ]
    rows = [
        [
            p.code,
            p.discount_type,
            p.discount_value,
            p.max_uses if p.max_uses is not None else "∞",
            p.used_count,
            "Да" if p.is_active else "Нет",
            p.created_at.strftime("%Y-%m-%d %H:%M"),
        ]
        for p in promos
    ]
    return _make_csv(headers, rows)


async def export_finance_pdf(
    session: AsyncSession,
    vendor: VendorProfile,
    date_from: date | None = None,
    date_to: date | None = None,
    restaurant_id: uuid.UUID | None = None,
) -> bytes:
    analytics = await admin_crud.get_finance_analytics(
        session,
        date_from=date_from,
        date_to=date_to,
        vendor_id=vendor.id,
        restaurant_id=restaurant_id,
    )
    return _build_finance_pdf("Финансовый отчёт вендора — Foodize", analytics, date_from, date_to)


async def export_analytics_pdf(
    session: AsyncSession,
    vendor: VendorProfile,
    date_from: date | None = None,
    date_to: date | None = None,
    restaurant_id: uuid.UUID | None = None,
) -> bytes:
    analytics = await admin_crud.get_advanced_analytics(
        session,
        date_from=date_from,
        date_to=date_to,
        vendor_id=vendor.id,
        restaurant_id=restaurant_id,
    )
    return _build_analytics_pdf(
        "Аналитический отчёт вендора — Foodize", analytics, date_from, date_to
    )
