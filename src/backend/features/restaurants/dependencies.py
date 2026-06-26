import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from features.restaurants.models import Restaurant
from shared.exceptions import RuleException
from shared.exceptions.existence import NotFoundException


async def get_restaurant_and_check_ownership(
    session: AsyncSession, restaurant_id: uuid.UUID, vendor_id: uuid.UUID
):
    restaurant = await session.get(Restaurant, restaurant_id)
    if not restaurant:
        raise NotFoundException()
    if restaurant.vendor_id != vendor_id:
        raise RuleException()
    return restaurant
