from enum import Enum


class EventType(str, Enum):
    ORDER_PLACED = "order.placed"
    ORDER_STATUS_CHANGED = "order.status_changed"
