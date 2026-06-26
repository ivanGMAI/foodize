import uuid

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from features.promos.models import Promo
from features.promos.schemas import PromoCreate
from features.restaurants.models import Restaurant


async def get_restaurant_ids_by_vendor(
    session: AsyncSession, vendor_id: uuid.UUID
) -> list[uuid.UUID]:
    result = await session.execute(select(Restaurant.id).where(Restaurant.vendor_id == vendor_id))
    return [row[0] for row in result.fetchall()]


async def get_promo_by_code(session: AsyncSession, code: str) -> Promo | None:
    result = await session.execute(select(Promo).where(Promo.code == code.upper()))
    return result.scalar_one_or_none()


async def get_promos_by_restaurant_ids(
    session: AsyncSession,
    restaurant_ids: list[uuid.UUID],
    offset: int = 0,
    limit: int = 20,
) -> list[Promo]:
    if not restaurant_ids:
        return []
    result = await session.execute(
        select(Promo)
        .where(Promo.restaurant_id.in_(restaurant_ids))
        .order_by(Promo.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(result.scalars().all())


async def count_promos_by_restaurant_ids(
    session: AsyncSession, restaurant_ids: list[uuid.UUID]
) -> int:
    if not restaurant_ids:
        return 0
    result = await session.execute(
        select(func.count()).select_from(Promo).where(Promo.restaurant_id.in_(restaurant_ids))
    )
    return result.scalar_one()


async def create_promo(session: AsyncSession, data: PromoCreate) -> Promo:
    promo = Promo(
        code=data.code.upper(),
        discount_type=data.discount_type,
        discount_value=data.discount_value,
        restaurant_id=data.restaurant_id,
        max_uses=data.max_uses,
        expires_at=data.expires_at,
    )
    session.add(promo)
    await session.commit()
    await session.refresh(promo)
    return promo


async def increment_used_count(session: AsyncSession, promo: Promo) -> bool:
    stmt = (
        update(Promo)
        .where(Promo.id == promo.id)
        .where((Promo.max_uses == None) | (Promo.used_count < Promo.max_uses))  # noqa: E711
        .values(used_count=Promo.used_count + 1)
    )
    result = await session.execute(stmt)
    return result.rowcount == 1  # type: ignore[attr-defined]


async def deactivate_promo(session: AsyncSession, promo: Promo) -> Promo:
    promo.is_active = False
    await session.commit()
    await session.refresh(promo)
    return promo
