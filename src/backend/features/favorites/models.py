import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, CreatedAtMixin, IdUuidPkMixin

if TYPE_CHECKING:
    from features.restaurants.models import Restaurant
    from features.users.models import User


class Favorite(Base, IdUuidPkMixin, CreatedAtMixin):
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"))

    user: Mapped["User"] = relationship(back_populates="favorites")
    restaurant: Mapped["Restaurant"] = relationship(back_populates="favorited_by")

    __table_args__ = (  # type: ignore[assignment]
        UniqueConstraint("user_id", "restaurant_id", name="uq_favorites_user_restaurant"),
    )
