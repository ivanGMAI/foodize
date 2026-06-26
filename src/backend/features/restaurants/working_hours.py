import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, IdUuidPkMixin

if TYPE_CHECKING:
    from features.restaurants.models import Restaurant


class WorkingHours(Base, IdUuidPkMixin):
    __tablename__ = "working_hours"

    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(Integer, nullable=False)
    open_time: Mapped[str] = mapped_column(String(5), nullable=False)
    close_time: Mapped[str] = mapped_column(String(5), nullable=False)
    is_closed: Mapped[bool] = mapped_column(default=False, server_default="false")

    restaurant: Mapped["Restaurant"] = relationship(back_populates="working_hours")
