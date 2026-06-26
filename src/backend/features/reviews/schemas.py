import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str | None = Field(None, max_length=1000)


class ReviewResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: str | None = None
    restaurant_id: uuid.UUID
    rating: int
    text: str | None = None
    is_verified_purchase: bool = False
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RatingResponse(BaseModel):
    restaurant_id: uuid.UUID
    average_rating: float | None
    review_count: int
