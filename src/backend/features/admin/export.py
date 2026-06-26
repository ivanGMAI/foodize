import csv
import io
import uuid
from datetime import UTC, date, datetime, timedelta

from fpdf import FPDF
from sqlalchemy.ext.asyncio import AsyncSession

from features.admin import crud
from features.admin.crud import STATUS_RU
from features.admin.schemas import AdvancedAnalytics, FinanceAnalytics, PlatformStats
from shared.enums.order_status import OrderStatus

_FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
_FONT_BOLD_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


class _PDF(FPDF):
    _BRAND = (255, 75, 0)
    _HEADER_BG = (20, 20, 30)
    _SECTION_BG = (245, 246, 250)
    _ROW_ALT = (252, 252, 255)
    _BORDER_CLR = (210, 213, 220)
    _TEXT_MUTED = (120, 125, 135)

    def __init__(self, title: str, subtitle: str = ""):
        super().__init__()
        self.add_font("dv", "", _FONT_PATH)
        self.add_font("dv", "B", _FONT_BOLD_PATH)
        self.set_font("dv", "", 10)
        self._title = title
        self._subtitle = subtitle
        self._row_index = 0
        self.add_page()
        self._draw_header()

    def _draw_header(self) -> None:
        self.set_fill_color(*self._HEADER_BG)
        self.rect(0, 0, self.w, 38, style="F")

        self.set_y(8)
        self.set_text_color(180, 185, 200)
        self.set_font("dv", "", 8)
        self.cell(0, 5, "FOODIZE · ПЛАТФОРМА ПРЕДЗАКАЗОВ", new_x="LMARGIN", new_y="NEXT", align="C")

        self.set_draw_color(*self._BRAND)
        self.set_line_width(0.8)
        mid = self.w / 2
        self.line(mid - 20, self.get_y() + 1, mid + 20, self.get_y() + 1)

        self.set_font("dv", "B", 15)
        self.set_text_color(255, 255, 255)
        self.cell(0, 10, self._title, new_x="LMARGIN", new_y="NEXT", align="C")

        self.set_y(44)
        self.set_text_color(0, 0, 0)
        self.set_draw_color(0, 0, 0)
        self.set_line_width(0.2)

        self.set_font("dv", "", 8)
        self.set_text_color(*self._TEXT_MUTED)
        self.cell(
            0,
            5,
            "Сформировано: "
            + (datetime.now(UTC) + timedelta(hours=3)).strftime("%d.%m.%Y в %H:%M")
            + " МСК",
            new_x="LMARGIN",
            new_y="NEXT",
            align="C",
        )
        self.set_text_color(0, 0, 0)
        self.ln(4)

    def footer(self) -> None:
        self.set_y(-14)
        self.set_draw_color(*self._BORDER_CLR)
        self.set_line_width(0.3)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)
        self.set_font("dv", "", 7)
        self.set_text_color(*self._TEXT_MUTED)
        self.cell(
            0, 5, f"Страница {self.page_no()} | Foodize — конфиденциальный документ", align="C"
        )
        self.set_text_color(0, 0, 0)

    def section(self, label: str) -> None:
        self.ln(2)
        self._row_index = 0
        self.set_fill_color(*self._SECTION_BG)
        self.set_draw_color(*self._BRAND)
        self.set_line_width(0.5)
        self.rect(self.l_margin, self.get_y(), 2.5, 8, style="F")
        self.set_x(self.l_margin + 4)
        self.set_font("dv", "B", 10)
        self.set_text_color(30, 30, 45)
        self.cell(0, 8, label, new_x="LMARGIN", new_y="NEXT", fill=True)
        self.set_text_color(0, 0, 0)
        self.set_draw_color(*self._BORDER_CLR)
        self.set_line_width(0.2)
        self.ln(1)

    def row(self, cells: list[tuple[str, int]], bold: bool = False, header: bool = False) -> None:
        if header:
            self.set_fill_color(50, 55, 75)
            self.set_text_color(255, 255, 255)
            self.set_font("dv", "B", 8)
        elif self._row_index % 2 == 0:
            self.set_fill_color(255, 255, 255)
            self.set_text_color(30, 30, 45)
            self.set_font("dv", "B" if bold else "", 8.5)
        else:
            self.set_fill_color(*self._ROW_ALT)
            self.set_text_color(30, 30, 45)
            self.set_font("dv", "B" if bold else "", 8.5)

        self.set_draw_color(*self._BORDER_CLR)
        for text, width in cells:
            self.cell(width, 7.5, str(text), border=1, fill=True)
        self.ln()

        if not header:
            self._row_index += 1

    def info_row(self, label: str, value: str) -> None:
        """Render a two-column key-value info row."""
        self.set_fill_color(*self._SECTION_BG)
        self.set_font("dv", "B", 9)
        self.set_text_color(80, 85, 100)
        self.cell(65, 7, label + ":", border="B", fill=True)
        self.set_font("dv", "", 9)
        self.set_text_color(20, 20, 35)
        self.cell(0, 7, value, new_x="LMARGIN", new_y="NEXT", border="B")
        self.set_text_color(0, 0, 0)


def _make_csv(headers: list[str], rows: list[list]) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(headers)
    writer.writerows(rows)
    return buf.getvalue().encode("utf-8-sig")


async def export_users_csv(session: AsyncSession) -> bytes:
    users = await crud.get_all_users(session, offset=0, limit=1_000_000)
    headers = ["ID", "Имя", "Телефон", "Email", "Telegram", "Права", "Активен", "Дата регистрации"]
    rows = [
        [
            str(u.id),
            u.name or "",
            u.phone_number,
            u.email or "",
            u.telegram_username or "",
            ",".join(str(p) for p in (u.permissions or [])),
            "Да" if u.is_active else "Нет",
            u.created_at.strftime("%Y-%m-%d %H:%M"),
        ]
        for u in users
    ]
    return _make_csv(headers, rows)


async def export_orders_csv(
    session: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
    status: OrderStatus | None = None,
) -> bytes:
    orders = await crud.get_all_orders(
        session, status=status, date_from=date_from, date_to=date_to, offset=0, limit=1_000_000
    )
    headers = [
        "ID",
        "Номер",
        "Клиент",
        "Телефон клиента",
        "Ресторан",
        "Статус",
        "Сумма (₽)",
        "Причина отмены",
        "Дата создания",
    ]
    rows = [
        [
            str(o.id),
            getattr(o, "display_id", None) or str(o.id)[:8],
            o.user.name if o.user else "",
            o.user.phone_number if o.user else "",
            o.restaurant.name if o.restaurant else "",
            STATUS_RU.get(o.status, o.status),
            o.total_price,
            getattr(o, "cancellation_reason", "") or "",
            o.created_at.strftime("%Y-%m-%d %H:%M"),
        ]
        for o in orders
    ]
    return _make_csv(headers, rows)


async def export_restaurants_csv(session: AsyncSession) -> bytes:
    restaurants = await crud.get_all_restaurants(session, offset=0, limit=1_000_000)
    headers = [
        "ID",
        "Название",
        "Адрес",
        "Вендор",
        "Телефон вендора",
        "Статус модерации",
        "Рейтинг",
        "Отзывов",
        "Заказов",
        "Дата создания",
    ]
    rows = [
        [
            str(r.id),
            r.name,
            r.address,
            r.vendor_name or "",
            r.vendor_phone or "",
            r.moderation_status,
            r.average_rating,
            r.review_count,
            r.orders_count,
            r.created_at.strftime("%Y-%m-%d %H:%M"),
        ]
        for r in restaurants
    ]
    return _make_csv(headers, rows)


async def export_vendors_csv(session: AsyncSession) -> bytes:
    vendors = await crud.get_all_vendors(session, offset=0, limit=1_000_000)
    headers = ["ID", "Имя", "Телефон", "Статус", "Ресторанов", "Дата заявки"]
    rows = [
        [
            str(v.id),
            v.user.name if v.user else "",
            v.user.phone_number if v.user else "",
            v.approval_status,
            len(v.restaurants or []),
            v.created_at.strftime("%Y-%m-%d %H:%M"),
        ]
        for v in vendors
    ]
    return _make_csv(headers, rows)


async def export_reviews_csv(
    session: AsyncSession,
    min_rating: int | None = None,
    max_rating: int | None = None,
) -> bytes:
    reviews = await crud.get_all_reviews(session, offset=0, limit=1_000_000)
    if min_rating is not None:
        reviews = [r for r in reviews if r.rating >= min_rating]
    if max_rating is not None:
        reviews = [r for r in reviews if r.rating <= max_rating]
    headers = ["ID", "Ресторан", "Автор", "Рейтинг", "Текст", "Подтв. покупка", "Дата"]
    rows = [
        [
            str(r.id),
            r.restaurant_name or "",
            r.user_name or "",
            r.rating,
            r.text or "",
            "Да" if r.is_verified_purchase else "Нет",
            r.created_at.strftime("%Y-%m-%d %H:%M"),
        ]
        for r in reviews
    ]
    return _make_csv(headers, rows)


def _build_finance_pdf(
    title: str,
    analytics: FinanceAnalytics,
    date_from: date | None,
    date_to: date | None,
) -> bytes:
    pdf = _PDF(title)
    pdf.set_font("dv", "", 9)

    period = (
        f"{date_from.strftime('%d.%m.%Y') if date_from else '—'}"
        f" — {date_to.strftime('%d.%m.%Y') if date_to else '—'}"
    )
    pdf.info_row("Период отчёта", period)
    growth_str = (
        f"{analytics.revenue_growth_pct:+.1f}%" if analytics.revenue_growth_pct is not None else "—"
    )
    pdf.info_row("Рост к предыдущему периоду", growth_str)
    pdf.ln(5)

    pdf.section("Ключевые показатели")
    pdf.row([("Показатель", 120), ("Значение", 75)], header=True)
    revenue_fmt = f"{analytics.total_revenue:,.0f} ₽".replace(",", " ")
    pdf.row([("Общая выручка", 120), (revenue_fmt, 75)])
    pdf.row([("Всего заказов", 120), (str(analytics.total_orders), 75)])
    pdf.row([("Выполнено заказов", 120), (str(analytics.completed_orders), 75)])
    pdf.row([("Отменено заказов", 120), (str(analytics.cancelled_orders), 75)])
    pdf.row([("Конверсия", 120), (f"{analytics.conversion_percent}%", 75)])
    pdf.row([("Средний чек (AOV)", 120), (f"{analytics.average_check:.0f} ₽", 75)])
    pdf.ln(5)

    pdf.section("Выручка по дням")
    pdf.row([("Дата", 90), ("Выручка (₽)", 105)], header=True)
    for point in analytics.revenue_by_day:
        pdf.row(
            [
                (point.date.strftime("%d.%m.%Y"), 90),
                (f"{int(point.value):,}".replace(",", " "), 105),
            ]
        )
    pdf.ln(5)

    pdf.section("Топ ресторанов по выручке")
    pdf.row([("#", 12), ("Название", 100), ("Выручка (₽)", 55), ("Заказов", 28)], header=True)
    for i, r in enumerate(analytics.top_restaurants, 1):
        rev_fmt = f"{int(r.revenue):,}".replace(",", " ")
        pdf.row([(str(i), 12), (r.name, 100), (rev_fmt, 55), (str(r.orders_count), 28)])
    pdf.ln(5)

    pdf.section("Топ блюд по продажам")
    pdf.row([("#", 12), ("Блюдо", 100), ("Продано", 33), ("Выручка (₽)", 50)], header=True)
    for i, item in enumerate(analytics.top_items, 1):
        rev_fmt = f"{int(item.revenue):,}".replace(",", " ")
        pdf.row([(str(i), 12), (item.name, 100), (str(item.quantity), 33), (rev_fmt, 50)])

    return bytes(pdf.output())


async def export_finance_pdf(
    session: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
    vendor_id: uuid.UUID | None = None,
    restaurant_id: uuid.UUID | None = None,
) -> bytes:
    analytics = await crud.get_finance_analytics(
        session,
        date_from=date_from,
        date_to=date_to,
        vendor_id=vendor_id,
        restaurant_id=restaurant_id,
    )
    return _build_finance_pdf("Финансовый отчёт — Foodize", analytics, date_from, date_to)


def _build_analytics_pdf(
    title: str,
    analytics: AdvancedAnalytics,
    date_from: date | None,
    date_to: date | None,
) -> bytes:
    pdf = _PDF(title)
    period = (
        f"{date_from.strftime('%d.%m.%Y') if date_from else '—'}"
        f" — {date_to.strftime('%d.%m.%Y') if date_to else '—'}"
    )
    pdf.info_row("Период анализа", period)
    pdf.ln(5)

    pdf.section("Почасовая нагрузка на платформу")
    pdf.row([("Час суток", 60), ("Заказов", 60)], header=True)
    for point in analytics.hourly_load:
        pdf.row([(f"{point.label}:00", 60), (str(point.value), 60)])
    pdf.ln(5)

    pdf.section("Выручка по категориям меню")
    pdf.row([("Категория", 100), ("Выручка (₽)", 55), ("Доля (%)", 40)], header=True)
    total_cat = sum(p.value for p in analytics.category_revenue) or 1
    for point in analytics.category_revenue:
        pct = round(point.value / total_cat * 100, 1)
        rev_fmt = f"{int(point.value):,}".replace(",", " ")
        pdf.row([(point.label, 100), (rev_fmt, 55), (f"{pct}%", 40)])
    pdf.ln(5)

    pdf.section("Динамика среднего чека (AOV)")
    pdf.row([("Дата", 90), ("Средний чек (₽)", 105)], header=True)
    for aov_point in analytics.aov_dynamics:
        pdf.row(
            [
                (aov_point.date.strftime("%d.%m.%Y"), 90),
                (f"{int(aov_point.value):,}".replace(",", " "), 105),
            ]
        )

    return bytes(pdf.output())


async def export_analytics_pdf(
    session: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
    vendor_id: uuid.UUID | None = None,
    restaurant_id: uuid.UUID | None = None,
) -> bytes:
    analytics = await crud.get_advanced_analytics(
        session,
        date_from=date_from,
        date_to=date_to,
        vendor_id=vendor_id,
        restaurant_id=restaurant_id,
    )
    return _build_analytics_pdf("Аналитический отчёт — Foodize", analytics, date_from, date_to)


async def export_overview_pdf(
    session: AsyncSession,
    date_from: date | None = None,
    date_to: date | None = None,
) -> bytes:
    stats: PlatformStats = await crud.get_platform_stats(session)

    pdf = _PDF("Обзор платформы — Foodize")

    pdf.info_row("Всего пользователей", str(stats.total_users))
    pdf.info_row("Всего ресторанов", str(stats.total_restaurants))
    pdf.info_row("Всего вендоров", str(stats.total_vendors))
    pdf.ln(5)

    ROLE_MAP = {
        "customers:read": "Клиенты",
        "restaurants:create": "Вендоры",
        "staff:profile:read": "Персонал (сотрудники)",
        "admin": "Администраторы",
    }

    def _infer_role_label(perm_key: str) -> str:
        for marker, label in ROLE_MAP.items():
            if marker in perm_key:
                return label
        return perm_key.replace(":", " ").title()

    pdf.section("Состав пользователей по ролям")
    pdf.row([("Роль", 120), ("Количество", 75)], header=True)
    for perm, count in stats.users_by_permission.items():
        pdf.row([(_infer_role_label(perm), 120), (str(count), 75)])
    pdf.ln(5)

    pdf.section("Заказы по статусам")
    pdf.row([("Статус", 120), ("Кол-во", 75)], header=True)
    for status, count in stats.orders_by_status.items():
        pdf.row([(STATUS_RU.get(status, status), 120), (str(count), 75)])
    pdf.ln(5)

    pdf.section("Рост платформы (последние 14 дней)")
    growth_users = {p.date: p.count for p in stats.growth.get("users", [])}
    growth_orders = {p.date: p.count for p in stats.growth.get("orders", [])}
    all_dates = sorted(set(list(growth_users.keys()) + list(growth_orders.keys())))
    pdf.row([("Дата", 65), ("Новых пользователей", 65), ("Новых заказов", 65)], header=True)
    for d in all_dates:
        pdf.row(
            [
                (d.strftime("%d.%m.%Y"), 65),
                (str(growth_users.get(d, 0)), 65),
                (str(growth_orders.get(d, 0)), 65),
            ]
        )

    return bytes(pdf.output())
