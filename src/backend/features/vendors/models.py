import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, CreatedAtMixin, IdUuidPkMixin, UpdatedAtMixin
from shared.enums.moderation_status import ModerationStatus

if TYPE_CHECKING:
    from features.restaurants.models import Restaurant
    from features.users.models import User


class VendorProfile(Base, IdUuidPkMixin, CreatedAtMixin, UpdatedAtMixin):
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True)
    approval_status: Mapped[str] = mapped_column(
        String,
        default=ModerationStatus.PENDING.value,
        server_default=ModerationStatus.PENDING.value,
        nullable=False,
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    user: Mapped["User"] = relationship(back_populates="vendor_profile")
    restaurants: Mapped[list["Restaurant"]] = relationship(back_populates="vendor")
