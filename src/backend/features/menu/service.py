import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from features.admin.audit_log import service as audit_service
from features.menu import crud
from features.menu.exceptions import MenuItemNotFoundException
from features.menu.models import MenuItem, MenuItemOption, MenuItemOptionGroup
from features.menu.schemas import (
    MenuItemCreate,
    MenuItemOptionCreate,
    MenuItemOptionGroupCreate,
    MenuItemOptionGroupResponse,
    MenuItemOptionGroupUpdate,
    MenuItemOptionResponse,
    MenuItemOptionUpdate,
    MenuItemResponse,
    MenuItemUpdate,
)
from features.restaurants.dependencies import get_restaurant_and_check_ownership
from shared.exceptions import BadRequestException, NotFoundException


async def add_menu_item(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_data: MenuItemCreate,
    vendor_id: uuid.UUID,
    actor_id: uuid.UUID | None = None,
) -> MenuItemResponse:
    await get_restaurant_and_check_ownership(
        session=session, restaurant_id=restaurant_id, vendor_id=vendor_id
    )
    item = await crud.create_menu_item(session, item_data, restaurant_id)

    await audit_service.log_action(
        session,
        actor_id=actor_id,
        action="CREATE_MENU_ITEM",
        entity_type="menu_item",
        entity_id=item.id,
        details={"restaurant_id": str(restaurant_id), "name": item.name},
    )
    await session.commit()
    return MenuItemResponse.model_validate(item)


async def get_menu(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    page: int = 1,
    size: int = 50,
) -> tuple[list[MenuItemResponse], int]:
    offset = (page - 1) * size
    data = await crud.get_menu_items(session, restaurant_id, offset=offset, limit=size)
    total = await crud.count_menu_items(session, restaurant_id)
    return [MenuItemResponse.model_validate(i) for i in data], total


async def _get_owned_menu_item(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    vendor_id: uuid.UUID,
) -> MenuItem:
    await get_restaurant_and_check_ownership(
        session=session, restaurant_id=restaurant_id, vendor_id=vendor_id
    )
    item = await crud.get_menu_item_by_id(session, item_id)
    if not item or item.restaurant_id != restaurant_id or item.is_deleted:
        raise MenuItemNotFoundException()
    return item


async def update_menu_item_for_vendor(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    item_data: MenuItemUpdate,
    vendor_id: uuid.UUID,
    actor_id: uuid.UUID | None = None,
) -> MenuItemResponse:
    item = await _get_owned_menu_item(session, restaurant_id, item_id, vendor_id)
    old_data = {
        "name": item.name,
        "price": item.price,
        "is_available": item.is_available,
    }
    updated = await crud.update_menu_item(session, item, item_data)

    await audit_service.log_action(
        session,
        actor_id=actor_id,
        action="UPDATE_MENU_ITEM",
        entity_type="menu_item",
        entity_id=updated.id,
        details={"old": old_data, "new": item_data.model_dump(exclude_unset=True)},
    )
    await session.commit()
    return MenuItemResponse.model_validate(updated)


async def delete_menu_item_for_vendor(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    vendor_id: uuid.UUID,
    actor_id: uuid.UUID | None = None,
) -> None:
    item = await _get_owned_menu_item(session, restaurant_id, item_id, vendor_id)
    await crud.delete_menu_item(session, item)

    await audit_service.log_action(
        session,
        actor_id=actor_id,
        action="DELETE_MENU_ITEM",
        entity_type="menu_item",
        entity_id=item_id,
        details={"restaurant_id": str(restaurant_id), "name": item.name},
    )
    await session.commit()


async def _get_owned_option_group(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    group_id: uuid.UUID,
    vendor_id: uuid.UUID,
) -> MenuItemOptionGroup:
    await _get_owned_menu_item(session, restaurant_id, item_id, vendor_id)
    group = await crud.get_option_group_by_id(session, group_id)
    if not group or group.menu_item_id != item_id:
        raise NotFoundException(detail="Option group not found")
    return group


async def _get_owned_option(
    session: AsyncSession,
    group_id: uuid.UUID,
    option_id: uuid.UUID,
) -> MenuItemOption:
    option = await crud.get_option_by_id(session, option_id)
    if not option or option.group_id != group_id:
        raise NotFoundException(detail="Option not found")
    return option


async def create_option_group_for_vendor(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    data: MenuItemOptionGroupCreate,
    vendor_id: uuid.UUID,
) -> MenuItemOptionGroupResponse:
    item = await _get_owned_menu_item(session, restaurant_id, item_id, vendor_id)
    group = await crud.create_option_group(session, item, data)
    return MenuItemOptionGroupResponse.model_validate(group)


async def update_option_group_for_vendor(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    group_id: uuid.UUID,
    data: MenuItemOptionGroupUpdate,
    vendor_id: uuid.UUID,
) -> MenuItemOptionGroupResponse:
    group = await _get_owned_option_group(session, restaurant_id, item_id, group_id, vendor_id)
    if data.max_selected is not None and data.min_selected is not None:
        if data.min_selected > data.max_selected:
            raise BadRequestException(detail="min_selected cannot be greater than max_selected")
    updated = await crud.update_option_group(session, group, data)
    return MenuItemOptionGroupResponse.model_validate(updated)


async def delete_option_group_for_vendor(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    group_id: uuid.UUID,
    vendor_id: uuid.UUID,
) -> None:
    group = await _get_owned_option_group(session, restaurant_id, item_id, group_id, vendor_id)
    await crud.delete_option_group(session, group)


async def create_option_for_vendor(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    group_id: uuid.UUID,
    data: MenuItemOptionCreate,
    vendor_id: uuid.UUID,
) -> MenuItemOptionResponse:
    group = await _get_owned_option_group(session, restaurant_id, item_id, group_id, vendor_id)
    option = await crud.create_option(session, group, data)
    return MenuItemOptionResponse.model_validate(option)


async def update_option_for_vendor(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    group_id: uuid.UUID,
    option_id: uuid.UUID,
    data: MenuItemOptionUpdate,
    vendor_id: uuid.UUID,
) -> MenuItemOptionResponse:
    await _get_owned_option_group(session, restaurant_id, item_id, group_id, vendor_id)
    option = await _get_owned_option(session, group_id, option_id)
    updated = await crud.update_option(session, option, data)
    return MenuItemOptionResponse.model_validate(updated)


async def delete_option_for_vendor(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    group_id: uuid.UUID,
    option_id: uuid.UUID,
    vendor_id: uuid.UUID,
) -> None:
    await _get_owned_option_group(session, restaurant_id, item_id, group_id, vendor_id)
    option = await _get_owned_option(session, group_id, option_id)
    await crud.delete_option(session, option)


async def toggle_item_availability_for_vendor(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    is_available: bool,
    vendor_id: uuid.UUID,
    actor_id: uuid.UUID | None = None,
) -> MenuItemResponse:
    item = await _get_owned_menu_item(session, restaurant_id, item_id, vendor_id)
    item.is_available = is_available
    await session.commit()

    await audit_service.log_action(
        session,
        actor_id=actor_id,
        action="TOGGLE_MENU_ITEM",
        entity_type="menu_item",
        entity_id=item_id,
        details={"is_available": is_available, "restaurant_id": str(restaurant_id)},
    )
    await session.commit()

    loaded = await crud.get_menu_item_by_id(session, item.id)
    return MenuItemResponse.model_validate(loaded)


async def toggle_item_availability_for_staff(
    session: AsyncSession,
    restaurant_id: uuid.UUID,
    item_id: uuid.UUID,
    is_available: bool,
) -> MenuItemResponse:
    item = await crud.get_menu_item_by_id(session, item_id)
    if not item or item.restaurant_id != restaurant_id or item.is_deleted:
        raise MenuItemNotFoundException()
    item.is_available = is_available
    await session.commit()
    loaded = await crud.get_menu_item_by_id(session, item.id)
    return MenuItemResponse.model_validate(loaded)
