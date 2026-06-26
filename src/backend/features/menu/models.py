import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base, CreatedAtMixin, DeletedAtMixin, IdUuidPkMixin, UpdatedAtMixin
from database.mixins.name_str import NameStrMixin
from shared.enums.category import Category
from shared.enums.selection_type import SelectionType

if TYPE_CHECKING:
    from features.orders.models import OrderItem
    from features.restaurants.models import Restaurant


class MenuItem(Base, IdUuidPkMixin, NameStrMixin, CreatedAtMixin, UpdatedAtMixin, DeletedAtMixin):
    description: Mapped[str | None]
    price: Mapped[int]
    prep_time_minutes: Mapped[int] = mapped_column(default=15, server_default="15")
    category: Mapped[str] = mapped_column(
        String, default=Category.SHAURMA.value, server_default=Category.SHAURMA.value, nullable=True
    )
    is_available: Mapped[bool] = mapped_column(default=True, server_default="true")
    is_deleted: Mapped[bool] = mapped_column(default=False, server_default="false")
    photo_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    restaurant_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("restaurants.id"))
    restaurant: Mapped["Restaurant"] = relationship(back_populates="menu_items")
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="menu_item")
    option_groups: Mapped[list["MenuItemOptionGroup"]] = relationship(
        back_populates="menu_item",
        cascade="all, delete-orphan",
        order_by="MenuItemOptionGroup.sort_order",
    )


class MenuItemOptionGroup(Base, IdUuidPkMixin, CreatedAtMixin, UpdatedAtMixin):
    menu_item_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("menu_items.id"))
    name: Mapped[str] = mapped_column(String(128))
    selection_type: Mapped[str] = mapped_column(
        String(16),
        default=SelectionType.MULTIPLE.value,
        server_default=SelectionType.MULTIPLE.value,
    )
    is_required: Mapped[bool] = mapped_column(default=False, server_default="false")
    min_selected: Mapped[int] = mapped_column(default=0, server_default="0")
    max_selected: Mapped[int | None] = mapped_column(nullable=True)
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    is_active: Mapped[bool] = mapped_column(default=True, server_default="true")
    menu_item: Mapped["MenuItem"] = relationship(back_populates="option_groups")
    options: Mapped[list["MenuItemOption"]] = relationship(
        back_populates="group",
        cascade="all, delete-orphan",
        order_by="MenuItemOption.sort_order",
    )


class MenuItemOption(Base, IdUuidPkMixin, CreatedAtMixin, UpdatedAtMixin):
    group_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("menu_item_option_groups.id"))
    name: Mapped[str] = mapped_column(String(128))
    price_delta: Mapped[int] = mapped_column(default=0, server_default="0")
    is_available: Mapped[bool] = mapped_column(default=True, server_default="true")
    sort_order: Mapped[int] = mapped_column(default=0, server_default="0")
    group: Mapped["MenuItemOptionGroup"] = relationship(back_populates="options")
