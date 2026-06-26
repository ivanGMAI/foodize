from sqlalchemy.orm import Mapped


class NameStrMixin:
    name: Mapped[str]
