import uuid

from pydantic import BaseModel, ConfigDict, Field

from shared.enums.permissions import Permission


class UserBase(BaseModel):
    name: str = Field(min_length=1, max_length=128)
    phone_number: str = Field(min_length=7, max_length=16, pattern=r"^\+?[0-9]{7,15}$")
    model_config = ConfigDict(from_attributes=True)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)
    model_config = ConfigDict(from_attributes=True)


class UserRead(UserBase):
    id: uuid.UUID
    permissions: list[Permission]
    has_password: bool = False
    first_name: str | None = None
    last_name: str | None = None
    middle_name: str | None = None
    email: str | None = None
    telegram_id: int | None = None
    telegram_username: str | None = None


class UserUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=128)
    first_name: str | None = Field(None, min_length=1, max_length=128)
    last_name: str | None = Field(None, min_length=1, max_length=128)
    middle_name: str | None = Field(None, min_length=1, max_length=128)
    email: str | None = Field(None, max_length=128)
    phone_number: str | None = Field(None, min_length=7, max_length=16, pattern=r"^\+?[0-9]{7,15}$")


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(min_length=8, max_length=128)
