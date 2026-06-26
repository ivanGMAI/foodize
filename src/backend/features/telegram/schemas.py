from datetime import datetime

from pydantic import BaseModel, Field

from features.auth.schemas import TokenResponse


class TelegramCheckRequest(BaseModel):
    init_data: str


class TelegramCheckResponse(BaseModel):
    status: str
    phone_number: str | None = None


class TelegramRegisterRequest(BaseModel):
    init_data: str
    phone_number: str = Field(min_length=7, max_length=16, pattern=r"^\+?[0-9]{7,15}$")
    name: str = Field(min_length=1, max_length=128)


class TelegramBotLinkRequest(BaseModel):
    telegram_id: int
    telegram_username: str | None = Field(default=None, max_length=64)
    phone_number: str = Field(min_length=7, max_length=16, pattern=r"^\+?[0-9]{7,15}$")
    name: str = Field(min_length=1, max_length=128)


class TelegramBotVendorStatusRequest(BaseModel):
    telegram_id: int


class TelegramBotVendorStatusResponse(BaseModel):
    is_vendor: bool
    approval_status: str | None = None
    rejection_reason: str | None = None


class TelegramBotOrdersRequest(BaseModel):
    telegram_id: int


class TelegramBotOrderSummary(BaseModel):
    id: str
    display_id: int
    status: str
    restaurant_name: str | None = None
    total_price: int
    created_at: datetime


class TelegramSiteLoginStartRequest(BaseModel):
    phone_number: str = Field(min_length=7, max_length=16, pattern=r"^\+?[0-9]{7,15}$")


class TelegramSiteLoginStartResponse(BaseModel):
    message: str = "Code sent"


class TelegramSiteLoginVerifyRequest(BaseModel):
    phone_number: str = Field(min_length=7, max_length=16, pattern=r"^\+?[0-9]{7,15}$")
    code: str = Field(min_length=4, max_length=8, pattern=r"^[0-9]+$")


class TelegramSiteLoginResponse(TokenResponse):
    requires_password: bool = False


class TelegramSitePasswordRequest(BaseModel):
    password: str = Field(min_length=8, max_length=128)


TelegramAuthResponse = TokenResponse
