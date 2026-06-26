import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from features.menu.models import MenuItem, MenuItemOption, MenuItemOptionGroup


async def get_menu_items_by_ids(
    session: AsyncSession, ids: list[uuid.UUID]
) -> dict[uuid.UUID, MenuItem]:
    result = await session.execute(
        select(MenuItem)
        .where(MenuItem.id.in_(ids))
        .options(selectinload(MenuItem.option_groups).selectinload(MenuItemOptionGroup.options))
    )
    return {mi.id: mi for mi in result.scalars().all()}


async def get_options_by_ids(
    session: AsyncSession,
    ids: list[uuid.UUID],
) -> dict[uuid.UUID, MenuItemOption]:
    if not ids:
        return {}
    result = await session.execute(
        select(MenuItemOption)
        .where(MenuItemOption.id.in_(ids))
        .options(selectinload(MenuItemOption.group))
    )
    return {option.id: option for option in result.scalars().all()}
