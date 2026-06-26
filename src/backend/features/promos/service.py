import uuid
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from features.admin.audit_log import service as audit_service
from features.promos import crud
from features.promos.exceptions import (
    PromoAlreadyExistsException,
    PromoNotActiveException,
    PromoNotFoundException,
    PromoRestaurantMismatchException,
    PromoUsageLimitException,
)
from features.promos.models import Promo
from features.promos.schemas import PromoCreate, PromoResponse, PromoValidateResponse
from features.restaurants.exceptions import RestaurantNotFoundException
from shared.enums.discount_type import DiscountType
from shared.exceptions.base import AppException


async def create_promo(
    session: AsyncSession,
    data: PromoCreate,
    vendor_restaurant_ids: list[uuid.UUID],
    actor_id: uuid.UUID | None = None,
) -> PromoResponse:
    if data.restaurant_id not in vendor_restaurant_ids:
        raise RestaurantNotFoundException()

    existing = await crud.get_promo_by_code(session, data.code)
    if existing:
        raise PromoAlreadyExistsException()

    promo = await crud.create_promo(session, data)

    await audit_service.log_action(
        session,
        actor_id=actor_id,
        action="CREATE_PROMO",
        entity_type="promo",
        entity_id=promo.id,
        details={"code": promo.code, "restaurant_id": str(promo.restaurant_id)},
    )
    await session.commit()
    return PromoResponse.model_validate(promo)


async def get_vendor_promos(
    session: AsyncSession,
    vendor_restaurant_ids: list[uuid.UUID],
    page: int = 1,
    size: int = 20,
) -> tuple[list[PromoResponse], int]:
    offset = (page - 1) * size
    results = await crud.get_promos_by_restaurant_ids(
        session, vendor_restaurant_ids, offset=offset, limit=size
    )
    total = await crud.count_promos_by_restaurant_ids(session, vendor_restaurant_ids)
    return [PromoResponse.model_validate(p) for p in results], total


async def deactivate_promo(
    session: AsyncSession,
    code: str,
    vendor_restaurant_ids: list[uuid.UUID],
    actor_id: uuid.UUID | None = None,
) -> PromoResponse:
    promo = await crud.get_promo_by_code(session, code)
    if not promo or promo.restaurant_id not in vendor_restaurant_ids:
        raise PromoNotFoundException()
    updated = await crud.deactivate_promo(session, promo)

    await audit_service.log_action(
        session,
        actor_id=actor_id,
        action="DEACTIVATE_PROMO",
        entity_type="promo",
        entity_id=updated.id,
        details={"code": code},
    )
    await session.commit()
    return PromoResponse.model_validate(updated)


def _validate_promo_active(
    promo: Promo,
    restaurant_id: uuid.UUID,
    order_total: int | None = None,
    is_first_order: bool = False,
) -> None:
    if promo.restaurant_id != restaurant_id:
        raise PromoRestaurantMismatchException()
    if not promo.is_active:
        raise PromoNotActiveException()
    if promo.expires_at and promo.expires_at < datetime.now(timezone.utc):
        raise PromoNotActiveException()
    if promo.max_uses is not None and promo.used_count >= promo.max_uses:
        raise PromoUsageLimitException()
    if promo.first_order_only and not is_first_order:
        raise AppException(status_code=400, detail="promo_first_order_only")
    if promo.min_order_amount is not None and order_total is not None:
        if order_total < promo.min_order_amount:
            raise AppException(status_code=400, detail="promo_min_order_amount")


async def validate_promo(
    session: AsyncSession,
    code: str,
    restaurant_id: uuid.UUID,
    order_total: int | None = None,
    is_first_order: bool = False,
) -> PromoValidateResponse:
    promo = await crud.get_promo_by_code(session, code)
    if not promo:
        raise PromoNotFoundException()
    _validate_promo_active(
        promo, restaurant_id, order_total=order_total, is_first_order=is_first_order
    )

    discounted_amount: int | None = None
    if order_total is not None:
        if promo.discount_type == DiscountType.PERCENT.value:
            discounted_amount = max(0, order_total - int(order_total * promo.discount_value / 100))
        else:
            discounted_amount = max(0, order_total - promo.discount_value)

    return PromoValidateResponse(
        code=promo.code,
        discount_type=promo.discount_type,
        discount_value=promo.discount_value,
        discounted_amount=discounted_amount,
        first_order_only=promo.first_order_only,
        min_order_amount=promo.min_order_amount,
    )


async def apply_promo(
    session: AsyncSession,
    code: str,
    restaurant_id: uuid.UUID,
    order_total: int,
    is_first_order: bool = False,
) -> int:
    promo = await crud.get_promo_by_code(session, code)
    if not promo:
        raise PromoNotFoundException()
    _validate_promo_active(
        promo, restaurant_id, order_total=order_total, is_first_order=is_first_order
    )

    if promo.discount_type == DiscountType.PERCENT.value:
        new_total = max(0, order_total - int(order_total * promo.discount_value / 100))
    else:
        new_total = max(0, order_total - promo.discount_value)

    incremented = await crud.increment_used_count(session, promo)
    if not incremented:
        raise PromoUsageLimitException()
    return new_total
