import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from features.favorites import crud as favorites_crud
from features.favorites.exceptions import (
    AlreadyFavoritedException,
    FavoriteNotFoundException,
)
from features.favorites.schemas import FavoriteResponse
from features.restaurants import crud as restaurant_crud
from features.restaurants.exceptions import RestaurantNotFoundException


async def add_favorite(
    session: AsyncSession,
    user_id: uuid.UUID,
    restaurant_id: uuid.UUID,
) -> FavoriteResponse:
    if not await restaurant_crud.get_restaurant_by_id(session, restaurant_id):
        raise RestaurantNotFoundException()

    existing = await favorites_crud.get_favorite(session, user_id, restaurant_id)
    if existing:
        raise AlreadyFavoritedException()

    favorite = await favorites_crud.create_favorite(session, user_id, restaurant_id)
    return FavoriteResponse.model_validate(favorite)


async def remove_favorite(
    session: AsyncSession,
    user_id: uuid.UUID,
    restaurant_id: uuid.UUID,
) -> None:
    favorite = await favorites_crud.get_favorite(session, user_id, restaurant_id)
    if not favorite:
        raise FavoriteNotFoundException()
    await favorites_crud.delete_favorite(session, favorite)


async def get_my_favorites(
    session: AsyncSession,
    user_id: uuid.UUID,
    page: int = 1,
    size: int = 20,
) -> tuple[list[FavoriteResponse], int]:
    offset = (page - 1) * size
    items = await favorites_crud.get_favorites_by_user(session, user_id, offset=offset, limit=size)
    total = await favorites_crud.count_favorites_by_user(session, user_id)
    return [FavoriteResponse.model_validate(f) for f in items], total
