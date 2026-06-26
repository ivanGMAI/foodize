import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator

from shared.enums.category import Category
from shared.enums.selection_type import SelectionType


class MenuItemCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    description: str | None = Field(None, max_length=512)
    price: int = Field(..., ge=1, le=100000000)
    category: Category = Category.SHAURMA
    prep_time_minutes: int = Field(15, ge=1, le=300)


class MenuItemUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    description: str | None = Field(None, max_length=512)
    price: int | None = Field(None, ge=1, le=100000000)
    category: Category | None = None
    is_available: bool | None = None
    prep_time_minutes: int | None = Field(None, ge=1, le=300)


class AvailabilityUpdate(BaseModel):
    is_available: bool


class MenuItemOptionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    price_delta: int = Field(0, ge=0, le=100000000)
    sort_order: int = Field(0, ge=0, le=10000)


class MenuItemOptionUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    price_delta: int | None = Field(None, ge=0, le=100000000)
    is_available: bool | None = None
    sort_order: int | None = Field(None, ge=0, le=10000)


class MenuItemOptionResponse(BaseModel):
    id: uuid.UUID
    group_id: uuid.UUID
    name: str
    price_delta: int
    is_available: bool
    sort_order: int

    model_config = ConfigDict(from_attributes=True)


class MenuItemOptionGroupCreate(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    selection_type: str = Field(
        SelectionType.MULTIPLE.value,
        pattern=f"^({SelectionType.SINGLE.value}|{SelectionType.MULTIPLE.value})$",
    )
    is_required: bool = False
    min_selected: int = Field(0, ge=0, le=50)
    max_selected: int | None = Field(None, ge=1, le=50)
    sort_order: int = Field(0, ge=0, le=10000)
    options: list[MenuItemOptionCreate] = Field(default_factory=list, max_length=50)

    @model_validator(mode="after")
    def validate_selection_limits(self):
        if self.selection_type == SelectionType.SINGLE.value:
            self.max_selected = 1
        if self.is_required and self.min_selected == 0:
            self.min_selected = 1
        if self.max_selected is not None and self.min_selected > self.max_selected:
            raise ValueError("min_selected cannot be greater than max_selected")
        return self


class MenuItemOptionGroupUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    selection_type: str | None = Field(
        None, pattern=f"^({SelectionType.SINGLE.value}|{SelectionType.MULTIPLE.value})$"
    )
    is_required: bool | None = None
    min_selected: int | None = Field(None, ge=0, le=50)
    max_selected: int | None = Field(None, ge=1, le=50)
    sort_order: int | None = Field(None, ge=0, le=10000)
    is_active: bool | None = None


class MenuItemOptionGroupResponse(BaseModel):
    id: uuid.UUID
    menu_item_id: uuid.UUID
    name: str
    selection_type: str
    is_required: bool
    min_selected: int
    max_selected: int | None = None
    sort_order: int
    is_active: bool
    options: list[MenuItemOptionResponse] = []

    model_config = ConfigDict(from_attributes=True)


class MenuItemResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    price: int
    category: Category
    restaurant_id: uuid.UUID
    is_available: bool
    prep_time_minutes: int
    photo_url: str | None = None
    option_groups: list[MenuItemOptionGroupResponse] = []

    model_config = ConfigDict(from_attributes=True)
