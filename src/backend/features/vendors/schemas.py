import uuid

from pydantic import BaseModel, ConfigDict

from shared.enums.moderation_status import ModerationStatus


class VendorCreate(BaseModel):
    pass


class VendorResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    approval_status: str = ModerationStatus.PENDING.value
    rejection_reason: str | None = None

    model_config = ConfigDict(from_attributes=True)
