import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, CreatedAtMixin, DeletedAtMixin, IdUuidPkMixin, UpdatedAtMixin
from database.mixins.name_str import NameStrMixin
from shared.enums.moderation_status import ModerationStatus

if TYPE_CHECKING:
    from features.favorites.models import Favorite
    from features.menu.models import MenuItem
    from features.orders.models import Order
    from features.promos.models import Promo
    from features.restaurants.working_hours import WorkingHours
    from features.reviews.models import Review
    from features.staff.models import StaffProfile, StaffRequest
    from features.vendors.models import VendorProfile


class Restaurant(Base, IdUuidPkMixin, NameStrMixin, CreatedAtMixin, UpdatedAtMixin, DeletedAtMixin):
    display_id: Mapped[str | None] = mapped_column(
        String(12), unique=True, index=True, nullable=True
    )
    address: Mapped[str] = mapped_column(unique=True)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendor_profiles.id"))
    is_hiring: Mapped[bool] = mapped_column(default=True, server_default="true")
    is_open: Mapped[bool] = mapped_column(default=True, server_default="true")
    is_ordering_paused: Mapped[bool] = mapped_column(default=False, server_default="false")
    ordering_paused_until: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    avg_prep_time_minutes: Mapped[int] = mapped_column(
        Integer, default=15, server_default="15", nullable=False
    )
    max_active_orders: Mapped[int | None] = mapped_column(Integer, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    moderation_status: Mapped[str] = mapped_column(
        String,
        default=ModerationStatus.PENDING.value,
        server_default=ModerationStatus.PENDING.value,
        nullable=False,
    )
    rejection_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    average_rating: Mapped[float] = mapped_column(default=0.0, server_default="0.0")
    review_count: Mapped[int] = mapped_column(default=0, server_default="0")
    vendor: Mapped["VendorProfile"] = relationship(back_populates="restaurants")
    menu_items: Mapped[list["MenuItem"]] = relationship(back_populates="restaurant")
    orders: Mapped[list["Order"]] = relationship(back_populates="restaurant")
    staff_requests: Mapped[list["StaffRequest"]] = relationship(back_populates="restaurant")
    staff_members: Mapped[list["StaffProfile"]] = relationship(back_populates="restaurant")
    reviews: Mapped[list["Review"]] = relationship(back_populates="restaurant")
    favorited_by: Mapped[list["Favorite"]] = relationship(back_populates="restaurant")
    promos: Mapped[list["Promo"]] = relationship(back_populates="restaurant")
    working_hours: Mapped[list["WorkingHours"]] = relationship(
        back_populates="restaurant", cascade="all, delete-orphan"
    )
