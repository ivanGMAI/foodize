import uuid
from datetime import datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class PromoCreate(BaseModel):
    code: str = Field(..., min_length=3, max_length=64)
    discount_type: Literal["PERCENT", "FIXED"]
    discount_value: int = Field(..., ge=1)
    restaurant_id: uuid.UUID
    max_uses: int | None = Field(None, ge=1)
    expires_at: datetime | None = None
    first_order_only: bool = False
    min_order_amount: int | None = Field(None, ge=1)
    menu_category: str | None = None

    @field_validator("expires_at")
    @classmethod
    def expires_at_must_be_future(cls, v: datetime | None) -> datetime | None:
        if v is not None and v <= datetime.now(timezone.utc):
            raise ValueError("expires_at must be in the future")
        return v


class PromoResponse(BaseModel):
    id: uuid.UUID
    code: str
    discount_type: str
    discount_value: int
    restaurant_id: uuid.UUID
    max_uses: int | None
    used_count: int
    expires_at: datetime | None
    is_active: bool
    created_at: datetime
    first_order_only: bool
    min_order_amount: int | None
    menu_category: str | None

    model_config = ConfigDict(from_attributes=True)


class PromoValidateRequest(BaseModel):
    code: str
    restaurant_id: uuid.UUID
    order_total: int | None = None
    is_first_order: bool = False


class PromoValidateResponse(BaseModel):
    code: str
    discount_type: str
    discount_value: int
    discounted_amount: int | None = None
    first_order_only: bool = False
    min_order_amount: int | None = None
