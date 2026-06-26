from sqlalchemy.orm import DeclarativeBase, declared_attr

from database.metadata import metadata
from utils import pluralize_snake_case


class Base(DeclarativeBase):
    __abstract__ = True
    __table_args__ = {"extend_existing": True}
    metadata = metadata

    @declared_attr
    def __tablename__(self):
        return f"{pluralize_snake_case(self.__name__)}"
