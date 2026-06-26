import uuid

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from features.menu.models import MenuItem, MenuItemOption, MenuItemOptionGroup
from features.menu.schemas import (
    MenuItemCreate,
    MenuItemOptionCreate,
    MenuItemOptionGroupCreate,
    MenuItemOptionGroupUpdate,
    MenuItemOptionUpdate,
    MenuItemUpdate,
)


def _option_groups_options():
    return selectinload(MenuItem.option_groups).selectinload(MenuItemOptionGroup.options)


async def create_menu_item(
    session: AsyncSession, item_data: MenuItemCreate, restaurant_id: uuid.UUID
) -> MenuItem:
    data = item_data.model_dump()
    if "category" in data and hasattr(data["category"], "value"):
        data["category"] = data["category"].value

    new_item = MenuItem(**data, restaurant_id=restaurant_id)
    session.add(new_item)
    await session.commit()
    loaded = await get_menu_item_by_id(session, new_item.id)
    if loaded is None:
        raise RuntimeError("Created menu item was not found")
    return loaded


async def get_menu_item_by_id(session: AsyncSession, item_id: uuid.UUID) -> MenuItem | None:
    result = await session.execute(
        select(MenuItem).where(MenuItem.id == item_id).options(_option_groups_options())
    )
    return result.scalar_one_or_none()


async def get_menu_items(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    offset: int = 0,
    limit: int = 50,
) -> list[MenuItem]:
    result = await session.execute(
        select(MenuItem)
        .where(
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.is_deleted == False,  # noqa: E712
        )
        .options(_option_groups_options())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def count_menu_items(session: AsyncSession, restaurant_id: uuid.UUID) -> int:
    result = await session.execute(
        select(func.count())
        .select_from(MenuItem)
        .where(
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.is_deleted == False,  # noqa: E712
        )
    )
    return result.scalar_one()


async def update_menu_item(
    session: AsyncSession, item: MenuItem, item_data: MenuItemUpdate
) -> MenuItem:
    update_data = item_data.model_dump(exclude_unset=True)
    if "category" in update_data and update_data["category"] is not None:
        if hasattr(update_data["category"], "value"):
            update_data["category"] = update_data["category"].value

    for key, value in update_data.items():
        setattr(item, key, value)
    await session.commit()
    loaded = await get_menu_item_by_id(session, item.id)
    if loaded is None:
        raise RuntimeError("Updated menu item was not found")
    return loaded


async def delete_menu_item(session: AsyncSession, item: MenuItem) -> None:
    item.is_deleted = True
    await session.commit()


async def create_option_group(
    session: AsyncSession,
    item: MenuItem,
    data: MenuItemOptionGroupCreate,
) -> MenuItemOptionGroup:
    option_group = MenuItemOptionGroup(
        menu_item_id=item.id,
        name=data.name,
        selection_type=data.selection_type,
        is_required=data.is_required,
        min_selected=data.min_selected,
        max_selected=data.max_selected,
        sort_order=data.sort_order,
    )
    for option_data in data.options:
        option_group.options.append(MenuItemOption(**option_data.model_dump()))
    session.add(option_group)
    await session.commit()
    await session.refresh(option_group, attribute_names=["options"])
    return option_group


async def get_option_group_by_id(
    session: AsyncSession,
    group_id: uuid.UUID,
) -> MenuItemOptionGroup | None:
    result = await session.execute(
        select(MenuItemOptionGroup)
        .where(MenuItemOptionGroup.id == group_id)
        .options(selectinload(MenuItemOptionGroup.options))
    )
    return result.scalar_one_or_none()


async def update_option_group(
    session: AsyncSession,
    group: MenuItemOptionGroup,
    data: MenuItemOptionGroupUpdate,
) -> MenuItemOptionGroup:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(group, key, value)
    if group.selection_type == "single":
        group.max_selected = 1
    await session.commit()
    await session.refresh(group, attribute_names=["options"])
    return group


async def delete_option_group(session: AsyncSession, group: MenuItemOptionGroup) -> None:
    group.is_active = False
    await session.commit()


async def create_option(
    session: AsyncSession,
    group: MenuItemOptionGroup,
    data: MenuItemOptionCreate,
) -> MenuItemOption:
    option = MenuItemOption(group_id=group.id, **data.model_dump())
    session.add(option)
    await session.commit()
    await session.refresh(option)
    return option


async def get_option_by_id(session: AsyncSession, option_id: uuid.UUID) -> MenuItemOption | None:
    return await session.get(MenuItemOption, option_id)


async def update_option(
    session: AsyncSession,
    option: MenuItemOption,
    data: MenuItemOptionUpdate,
) -> MenuItemOption:
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(option, key, value)
    await session.commit()
    await session.refresh(option)
    return option


async def delete_option(session: AsyncSession, option: MenuItemOption) -> None:
    option.is_available = False
    await session.commit()
