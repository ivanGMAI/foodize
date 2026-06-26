import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, CreatedAtMixin, IdUuidPkMixin

if TYPE_CHECKING:
    from features.menu.models import MenuItem
    from features.orders.models.order import Order
    from features.orders.models.order_item_option import OrderItemOption


class OrderItem(Base, IdUuidPkMixin, CreatedAtMixin):
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("orders.id"))
    menu_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("menu_items.id"))
    quantity: Mapped[int] = mapped_column(default=1)
    price_at_purchase: Mapped[int]
    order: Mapped["Order"] = relationship(back_populates="items")
    menu_item: Mapped["MenuItem"] = relationship(back_populates="order_items")
    selected_options: Mapped[list["OrderItemOption"]] = relationship(
        back_populates="order_item",
        cascade="all, delete-orphan",
    )
