import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from shared.enums.order_status import OrderStatus
from shared.enums.permissions import Permission


class OrderEventResponse(BaseModel):
    id: uuid.UUID
    order_id: uuid.UUID
    actor_id: uuid.UUID
    actor_permissions: list[Permission]
    old_status: OrderStatus
    new_status: OrderStatus
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
