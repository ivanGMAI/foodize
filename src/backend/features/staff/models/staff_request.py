import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, CreatedAtMixin, IdUuidPkMixin, UpdatedAtMixin
from shared.enums.staff_request_status import StaffRequestStatus

if TYPE_CHECKING:
    from features.restaurants.models import Restaurant
    from features.users.models import User


class StaffRequest(Base, IdUuidPkMixin, CreatedAtMixin, UpdatedAtMixin):
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"))

    message: Mapped[str | None] = mapped_column(String(500))
    status: Mapped[str] = mapped_column(
        String,
        default=StaffRequestStatus.PENDING.value,
        server_default=StaffRequestStatus.PENDING.value,
        nullable=False,
    )
    user: Mapped["User"] = relationship(back_populates="staff_requests")
    restaurant: Mapped["Restaurant"] = relationship(back_populates="staff_requests")
