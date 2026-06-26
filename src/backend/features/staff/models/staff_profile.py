import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, CreatedAtMixin, IdUuidPkMixin, UpdatedAtMixin
from shared.enums.staff_roles import StaffRole

if TYPE_CHECKING:
    from features.restaurants.models import Restaurant
    from features.users.models import User


class StaffProfile(Base, IdUuidPkMixin, CreatedAtMixin, UpdatedAtMixin):
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"))

    role: Mapped[str] = mapped_column(
        String, default=StaffRole.COOK.value, server_default=StaffRole.COOK.value, nullable=False
    )

    user: Mapped["User"] = relationship(back_populates="staff_profile")
    restaurant: Mapped["Restaurant"] = relationship(back_populates="staff_members")
