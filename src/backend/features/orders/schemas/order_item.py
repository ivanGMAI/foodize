import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from shared.enums.category import Category


class OrderItemCreate(BaseModel):
    menu_item_id: uuid.UUID
    quantity: int = Field(1, ge=1, le=99)
    selected_option_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)

    @field_validator("selected_option_ids")
    @classmethod
    def selected_option_ids_must_be_unique(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Duplicate options selected")
        return value


class OrderItemOptionResponse(BaseModel):
    id: uuid.UUID
    option_id: uuid.UUID | None
    name: str
    price_delta: int

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def flatten_option_snapshot(cls, data):
        if hasattr(data, "name_snapshot"):
            return {
                "id": data.id,
                "option_id": data.option_id,
                "name": data.name_snapshot,
                "price_delta": data.price_delta_snapshot,
            }
        return data


class OrderItemResponse(BaseModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    menu_item_name: str
    menu_item_category: Category
    menu_item_prep_time: int
    quantity: int
    price_at_purchase: int
    selected_options: list[OrderItemOptionResponse] = []

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def flatten_menu_item(cls, data):
        if hasattr(data, "menu_item"):
            mi = data.menu_item
            return {
                "id": data.id,
                "menu_item_id": data.menu_item_id,
                "menu_item_name": mi.name,
                "menu_item_category": mi.category,
                "menu_item_prep_time": mi.prep_time_minutes,
                "quantity": data.quantity,
                "price_at_purchase": data.price_at_purchase,
                "selected_options": data.selected_options,
            }
        return data
