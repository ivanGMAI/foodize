import uuid
from datetime import datetime, timezone

from pydantic import BaseModel, Field

from shared.enums.event_type import EventType
from shared.enums.order_status import OrderStatus


class OrderStatusChangedEvent(BaseModel):
    event_type: str = EventType.ORDER_STATUS_CHANGED.value
    event_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    order_id: uuid.UUID
    order_display_id: str | None = None
    user_id: uuid.UUID
    restaurant_id: uuid.UUID
    restaurant_name: str
    old_status: OrderStatus
    new_status: OrderStatus
    total_price: int


class OrderPlacedEvent(BaseModel):
    event_type: str = EventType.ORDER_PLACED.value
    event_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    order_id: uuid.UUID
    order_display_id: str | None = None
    user_id: uuid.UUID
    restaurant_id: uuid.UUID
    restaurant_name: str
    total_price: int
    items_count: int
