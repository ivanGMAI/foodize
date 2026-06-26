from sqlalchemy import MetaData

from settings.config.app_config import settings

metadata = MetaData(naming_convention=settings.db.naming_convention)
