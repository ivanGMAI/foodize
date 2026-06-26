import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, CreatedAtMixin, IdUuidPkMixin

if TYPE_CHECKING:
    from features.orders.models.order_item import OrderItem


class OrderItemOption(Base, IdUuidPkMixin, CreatedAtMixin):
    order_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("order_items.id"))
    option_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("menu_item_options.id"),
        nullable=True,
    )
    name_snapshot: Mapped[str] = mapped_column(String(128))
    price_delta_snapshot: Mapped[int] = mapped_column(default=0, server_default="0")
    order_item: Mapped["OrderItem"] = relationship(back_populates="selected_options")
