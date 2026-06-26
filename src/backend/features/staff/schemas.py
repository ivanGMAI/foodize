import uuid

from pydantic import BaseModel, ConfigDict, Field

from shared.enums.staff_request_status import StaffRequestStatus


class StaffRequestCreate(BaseModel):
    message: str | None = Field(None, max_length=512)


class StaffRequestStatusUpdate(BaseModel):
    status: StaffRequestStatus


class StaffRequestResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    restaurant_id: uuid.UUID
    message: str | None
    status: StaffRequestStatus

    model_config = ConfigDict(from_attributes=True)


class StaffProfileResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    restaurant_id: uuid.UUID
    role: str

    model_config = ConfigDict(from_attributes=True)


class StaffMemberResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    restaurant_id: uuid.UUID
    restaurant_name: str | None
    role: str
    user_name: str | None
    user_phone: str | None

    model_config = ConfigDict(from_attributes=True)
