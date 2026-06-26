import uuid
from datetime import date, datetime
from unittest.mock import AsyncMock, patch

import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from features.admin.export import (
    export_analytics_pdf,
    export_finance_pdf,
    export_orders_csv,
    export_overview_pdf,
    export_restaurants_csv,
    export_reviews_csv,
    export_users_csv,
    export_vendors_csv,
)
from features.admin.schemas import (
    AdvancedAnalytics,
    AnalyticsPoint,
    FinanceAnalytics,
    FinanceSeriesPoint,
    FinanceTopItem,
    FinanceTopRestaurant,
    PlatformStats,
    StatsGrowthPoint,
)
from shared.enums.order_status import OrderStatus


class DummyPDF:
    def __init__(self, *args, **kwargs):
        self.page = 1

    def section(self, *args, **kwargs):
        pass

    def row(self, *args, **kwargs):
        pass

    def info_row(self, *args, **kwargs):
        pass

    def ln(self, *args, **kwargs):
        pass

    def set_font(self, *args, **kwargs):
        pass

    def output(self, *args, **kwargs):
        return b"mock_pdf_bytes"


class MockUser:
    def __init__(self):
        self.id = uuid.uuid4()
        self.name = "Test User"
        self.phone_number = "12345"
        self.email = "test@example.com"
        self.telegram_username = "test_tg"
        self.permissions = ["admin"]
        self.is_active = True
        self.created_at = datetime.now()


class MockRestaurant:
    def __init__(self):
        self.id = uuid.uuid4()
        self.name = "Rest 1"
        self.address = "Addr 1"
        self.vendor_name = "Vendor 1"
        self.vendor_phone = "54321"
        self.moderation_status = "APPROVED"
        self.average_rating = 4.5
        self.review_count = 10
        self.orders_count = 20
        self.created_at = datetime.now()


class MockOrder:
    def __init__(self):
        self.id = uuid.uuid4()
        self.display_id = 1001
        self.user = MockUser()
        self.restaurant = MockRestaurant()
        self.status = OrderStatus.COMPLETED
        self.total_price = 500
        self.cancellation_reason = ""
        self.created_at = datetime.now()


class MockVendor:
    def __init__(self):
        self.id = uuid.uuid4()
        self.user = MockUser()
        self.approval_status = "APPROVED"
        self.restaurants = [MockRestaurant()]
        self.created_at = datetime.now()


class MockReview:
    def __init__(self):
        self.id = uuid.uuid4()
        self.restaurant_name = "Rest 1"
        self.user_name = "User 1"
        self.rating = 5
        self.text = "Great!"
        self.is_verified_purchase = True
        self.created_at = datetime.now()


@pytest.mark.asyncio
async def test_export_users_csv():
    mock_session = AsyncMock(spec=AsyncSession)
    mock_users = [MockUser()]
    with patch(
        "features.admin.crud.get_all_users", new_callable=AsyncMock, return_value=mock_users
    ):
        res = await export_users_csv(mock_session)
        assert isinstance(res, bytes)
        assert b"test@example.com" in res


@pytest.mark.asyncio
async def test_export_orders_csv():
    mock_session = AsyncMock(spec=AsyncSession)
    mock_orders = [MockOrder()]
    with patch(
        "features.admin.crud.get_all_orders", new_callable=AsyncMock, return_value=mock_orders
    ):
        res = await export_orders_csv(mock_session)
        assert isinstance(res, bytes)
        assert b"1001" in res or b"COMPLETED" in res


@pytest.mark.asyncio
async def test_export_restaurants_csv():
    mock_session = AsyncMock(spec=AsyncSession)
    mock_rests = [MockRestaurant()]
    with patch(
        "features.admin.crud.get_all_restaurants", new_callable=AsyncMock, return_value=mock_rests
    ):
        res = await export_restaurants_csv(mock_session)
        assert isinstance(res, bytes)
        assert b"Rest 1" in res


@pytest.mark.asyncio
async def test_export_vendors_csv():
    mock_session = AsyncMock(spec=AsyncSession)
    mock_vendors = [MockVendor()]
    with patch(
        "features.admin.crud.get_all_vendors", new_callable=AsyncMock, return_value=mock_vendors
    ):
        res = await export_vendors_csv(mock_session)
        assert isinstance(res, bytes)


@pytest.mark.asyncio
async def test_export_reviews_csv():
    mock_session = AsyncMock(spec=AsyncSession)
    mock_reviews = [MockReview()]
    with patch(
        "features.admin.crud.get_all_reviews", new_callable=AsyncMock, return_value=mock_reviews
    ):
        res = await export_reviews_csv(mock_session, min_rating=1, max_rating=5)
        assert isinstance(res, bytes)
        assert b"Great!" in res


@pytest.mark.asyncio
async def test_export_finance_pdf():
    mock_session = AsyncMock(spec=AsyncSession)
    mock_analytics = FinanceAnalytics(
        revenue_by_day=[FinanceSeriesPoint(date=date.today(), value=1000)],
        average_check=500.0,
        top_restaurants=[
            FinanceTopRestaurant(
                restaurant_id=uuid.uuid4(), name="Rest 1", revenue=1000, orders_count=2
            )
        ],
        top_items=[
            FinanceTopItem(menu_item_id=uuid.uuid4(), name="Dish 1", quantity=5, revenue=500)
        ],
        cancelled_orders=1,
        total_orders=10,
        completed_orders=9,
        conversion_percent=90.0,
        total_revenue=4500,
        revenue_growth_pct=10.0,
    )
    with (
        patch(
            "features.admin.crud.get_finance_analytics",
            new_callable=AsyncMock,
            return_value=mock_analytics,
        ),
        patch("features.admin.export._PDF", DummyPDF),
    ):
        res = await export_finance_pdf(mock_session, date.today(), date.today())
        assert res == b"mock_pdf_bytes"


@pytest.mark.asyncio
async def test_export_analytics_pdf():
    mock_session = AsyncMock(spec=AsyncSession)
    mock_analytics = AdvancedAnalytics(
        hourly_load=[AnalyticsPoint(label="12", value=5)],
        category_revenue=[AnalyticsPoint(label="Pizza", value=2000)],
        aov_dynamics=[FinanceSeriesPoint(date=date.today(), value=500)],
        retention=[],
    )
    with (
        patch(
            "features.admin.crud.get_advanced_analytics",
            new_callable=AsyncMock,
            return_value=mock_analytics,
        ),
        patch("features.admin.export._PDF", DummyPDF),
    ):
        res = await export_analytics_pdf(mock_session)
        assert res == b"mock_pdf_bytes"


@pytest.mark.asyncio
async def test_export_overview_pdf():
    mock_session = AsyncMock(spec=AsyncSession)
    mock_stats = PlatformStats(
        users_by_permission={"customers:read": 10},
        users_by_role={"CUSTOMER": 10},
        total_users=10,
        orders_by_status={"COMPLETED": 5},
        total_restaurants=1,
        total_vendors=1,
        growth={"users": [StatsGrowthPoint(date=date.today(), count=1)]},
    )
    with (
        patch(
            "features.admin.crud.get_platform_stats",
            new_callable=AsyncMock,
            return_value=mock_stats,
        ),
        patch("features.admin.export._PDF", DummyPDF),
    ):
        res = await export_overview_pdf(mock_session)
        assert res == b"mock_pdf_bytes"
