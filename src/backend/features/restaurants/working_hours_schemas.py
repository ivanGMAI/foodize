import uuid

from pydantic import BaseModel, ConfigDict, Field


class WorkingHoursEntry(BaseModel):
    day_of_week: int = Field(..., ge=0, le=6)
    open_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    close_time: str = Field(..., pattern=r"^\d{2}:\d{2}$")
    is_closed: bool = False


class WorkingHoursRead(WorkingHoursEntry):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    model_config = ConfigDict(from_attributes=True)


class WorkingHoursBulkSet(BaseModel):
    hours: list[WorkingHoursEntry] = Field(..., min_length=1, max_length=7)
