import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FavoriteRestaurantInfo(BaseModel):
    id: uuid.UUID
    name: str
    address: str
    is_open: bool
    is_hiring: bool

    model_config = ConfigDict(from_attributes=True)


class FavoriteResponse(BaseModel):
    id: uuid.UUID
    restaurant: FavoriteRestaurantInfo
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
