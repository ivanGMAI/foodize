import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, model_validator

from shared.enums.moderation_status import ModerationStatus
from shared.enums.permissions import Permission


class AdminUserResponse(BaseModel):
    id: uuid.UUID
    name: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    telegram_username: str | None = None
    phone_number: str
    permissions: list[Permission]
    is_active: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class StatsGrowthPoint(BaseModel):
    date: date
    count: int


class PlatformStats(BaseModel):
    users_by_permission: dict[str, int]
    users_by_role: dict[str, int]
    total_users: int
    orders_by_status: dict[str, int]
    total_restaurants: int
    total_vendors: int
    growth: dict[str, list[StatsGrowthPoint]]


class FinanceSeriesPoint(BaseModel):
    date: date
    value: int


class FinanceTopRestaurant(BaseModel):
    restaurant_id: uuid.UUID
    name: str
    revenue: int
    orders_count: int


class FinanceTopItem(BaseModel):
    menu_item_id: uuid.UUID
    name: str
    quantity: int
    revenue: int


class FinanceAnalytics(BaseModel):
    revenue_by_day: list[FinanceSeriesPoint]
    average_check: float
    top_restaurants: list[FinanceTopRestaurant]
    top_items: list[FinanceTopItem]
    cancelled_orders: int
    total_orders: int
    completed_orders: int
    conversion_percent: float
    total_revenue: int = 0
    revenue_growth_pct: float | None = None


class AnalyticsPoint(BaseModel):
    label: str
    value: float | int


class CohortPoint(BaseModel):
    cohort: str
    day: int
    retention: float


class AdvancedAnalytics(BaseModel):
    hourly_load: list[AnalyticsPoint]
    category_revenue: list[AnalyticsPoint]
    aov_dynamics: list[FinanceSeriesPoint]
    retention: list[CohortPoint]


class ModerationDecision(BaseModel):
    reason: str | None = None


class AdminRestaurantResponse(BaseModel):
    id: uuid.UUID
    display_id: str | None = None
    name: str
    address: str
    vendor_id: uuid.UUID
    vendor_name: str | None = None
    vendor_phone: str | None = None
    is_hiring: bool
    is_open: bool
    is_active: bool
    photo_url: str | None = None
    average_rating: float = 0.0
    review_count: int = 0
    orders_count: int = 0
    moderation_status: str = ModerationStatus.PENDING.value
    rejection_reason: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AdminVendorResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    name: str | None = None
    phone_number: str | None = None
    restaurants_count: int = 0
    approval_status: str = ModerationStatus.PENDING.value
    rejection_reason: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def flatten_user(cls, data):
        if isinstance(data, dict):
            return data

        user = getattr(data, "user", None)
        if user is not None:
            return {
                "id": data.id,
                "user_id": data.user_id,
                "name": user.name,
                "phone_number": user.phone_number,
                "restaurants_count": len(data.restaurants or []),
                "approval_status": data.approval_status,
                "rejection_reason": data.rejection_reason,
                "created_at": data.created_at,
            }
        return data


class AdminReviewResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None = None
    user_phone: str | None = None
    restaurant_id: uuid.UUID
    restaurant_name: str | None = None
    rating: int
    text: str | None = None
    is_verified_purchase: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
