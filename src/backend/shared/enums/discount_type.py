from enum import Enum


class DiscountType(str, Enum):
    PERCENT = "PERCENT"
    FIXED = "FIXED"
