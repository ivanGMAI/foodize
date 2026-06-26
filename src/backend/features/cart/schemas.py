import uuid

from pydantic import BaseModel, Field, field_validator, model_validator


class MenuItemShort(BaseModel):
    id: uuid.UUID
    name: str
    price: int
    image_url: str | None = None


class CartSelectedOption(BaseModel):
    option_id: uuid.UUID
    name: str
    price_delta: int = Field(..., ge=0)


class CartItemResponse(BaseModel):
    menuItem: MenuItemShort
    quantity: int
    selected_option_ids: list[uuid.UUID] = []
    selected_options: list[CartSelectedOption] = []


class CartResponse(BaseModel):
    restaurant_id: uuid.UUID | None
    items: list[CartItemResponse]


class CartItemIn(BaseModel):
    menu_item_id: uuid.UUID
    name: str
    price: int = Field(..., ge=0)
    image_url: str | None = None
    quantity: int = Field(..., ge=1, le=99)
    selected_option_ids: list[uuid.UUID] = Field(default_factory=list, max_length=50)
    selected_options: list[CartSelectedOption] = Field(default_factory=list, max_length=50)

    @field_validator("selected_option_ids")
    @classmethod
    def selected_option_ids_must_be_unique(cls, value: list[uuid.UUID]) -> list[uuid.UUID]:
        if len(value) != len(set(value)):
            raise ValueError("Duplicate options selected")
        return value

    @model_validator(mode="after")
    def selected_options_must_be_unique(self) -> "CartItemIn":
        option_ids = [option.option_id for option in self.selected_options]
        if len(option_ids) != len(set(option_ids)):
            raise ValueError("Duplicate options selected")
        return self


class CartUpdate(BaseModel):
    restaurant_id: uuid.UUID
    items: list[CartItemIn]
