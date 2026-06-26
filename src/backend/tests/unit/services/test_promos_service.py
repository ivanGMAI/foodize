import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.promos.service import (
    apply_promo,
    create_promo,
    deactivate_promo,
    get_vendor_promos,
    validate_promo,
)


def _make_promo(
    discount_type: str = "PERCENT",
    discount_value: int = 10,
    is_active: bool = True,
    max_uses: int | None = None,
    used_count: int = 0,
    expires_at: datetime | None = None,
) -> MagicMock:
    p = MagicMock()
    p.id = uuid.uuid4()
    p.code = "TEST10"
    p.discount_type = discount_type
    p.discount_value = discount_value
    p.restaurant_id = uuid.uuid4()
    p.max_uses = max_uses
    p.used_count = used_count
    p.expires_at = expires_at
    p.is_active = is_active
    p.created_at = datetime.now()
    p.first_order_only = False
    p.min_order_amount = None
    p.menu_category = None
    return p


def _mock_session() -> AsyncMock:
    session = AsyncMock()
    session.add = MagicMock()
    return session


class TestCreatePromo:
    @pytest.mark.asyncio
    async def test_restaurant_not_in_vendor_list(self):
        from features.promos.schemas import PromoCreate
        from features.restaurants.exceptions import RestaurantNotFoundException

        data = PromoCreate(
            code="CODE1",
            discount_type="PERCENT",
            discount_value=10,
            restaurant_id=uuid.uuid4(),
        )
        with pytest.raises(RestaurantNotFoundException):
            await create_promo(MagicMock(), data, [])

    @pytest.mark.asyncio
    async def test_promo_already_exists(self):
        from features.promos.exceptions import PromoAlreadyExistsException
        from features.promos.schemas import PromoCreate

        restaurant_id = uuid.uuid4()
        data = PromoCreate(
            code="EXIST",
            discount_type="PERCENT",
            discount_value=10,
            restaurant_id=restaurant_id,
        )

        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=MagicMock(),
        ):
            with pytest.raises(PromoAlreadyExistsException):
                await create_promo(MagicMock(), data, [restaurant_id])

    @pytest.mark.asyncio
    async def test_success(self):
        from features.promos.schemas import PromoCreate

        restaurant_id = uuid.uuid4()
        data = PromoCreate(
            code="NEW10",
            discount_type="PERCENT",
            discount_value=10,
            restaurant_id=restaurant_id,
        )
        promo = _make_promo()
        promo.restaurant_id = restaurant_id

        with (
            patch(
                "features.promos.crud.get_promo_by_code",
                new_callable=AsyncMock,
                return_value=None,
            ),
            patch(
                "features.promos.crud.create_promo",
                new_callable=AsyncMock,
                return_value=promo,
            ),
        ):
            result = await create_promo(_mock_session(), data, [restaurant_id])
            assert result.code == promo.code


class TestGetVendorPromos:
    @pytest.mark.asyncio
    async def test_success(self):
        promo = _make_promo()

        with (
            patch(
                "features.promos.crud.get_promos_by_restaurant_ids",
                new_callable=AsyncMock,
                return_value=[promo],
            ),
            patch(
                "features.promos.crud.count_promos_by_restaurant_ids",
                new_callable=AsyncMock,
                return_value=1,
            ),
        ):
            data, total = await get_vendor_promos(MagicMock(), [promo.restaurant_id])
            assert len(data) == 1
            assert total == 1

    @pytest.mark.asyncio
    async def test_empty(self):
        with (
            patch(
                "features.promos.crud.get_promos_by_restaurant_ids",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "features.promos.crud.count_promos_by_restaurant_ids",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            data, total = await get_vendor_promos(MagicMock(), [])
            assert data == []
            assert total == 0


class TestDeactivatePromo:
    @pytest.mark.asyncio
    async def test_not_found(self):
        from features.promos.exceptions import PromoNotFoundException

        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(PromoNotFoundException):
                await deactivate_promo(MagicMock(), "NOCODE", [uuid.uuid4()])

    @pytest.mark.asyncio
    async def test_wrong_restaurant(self):
        from features.promos.exceptions import PromoNotFoundException

        promo = _make_promo()
        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=promo,
        ):
            with pytest.raises(PromoNotFoundException):
                await deactivate_promo(MagicMock(), "TEST10", [uuid.uuid4()])

    @pytest.mark.asyncio
    async def test_success(self):
        promo = _make_promo()
        updated = _make_promo(is_active=False)
        updated.restaurant_id = promo.restaurant_id

        with (
            patch(
                "features.promos.crud.get_promo_by_code",
                new_callable=AsyncMock,
                return_value=promo,
            ),
            patch(
                "features.promos.crud.deactivate_promo",
                new_callable=AsyncMock,
                return_value=updated,
            ),
        ):
            result = await deactivate_promo(_mock_session(), "TEST10", [promo.restaurant_id])
            assert result.is_active is False


class TestValidatePromo:
    @pytest.mark.asyncio
    async def test_not_found(self):
        from features.promos.exceptions import PromoNotFoundException

        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(PromoNotFoundException):
                await validate_promo(MagicMock(), "NOCODE", uuid.uuid4())

    @pytest.mark.asyncio
    async def test_restaurant_mismatch(self):
        from features.promos.exceptions import PromoRestaurantMismatchException

        promo = _make_promo()
        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=promo,
        ):
            with pytest.raises(PromoRestaurantMismatchException):
                await validate_promo(MagicMock(), "TEST10", uuid.uuid4())

    @pytest.mark.asyncio
    async def test_not_active(self):
        from features.promos.exceptions import PromoNotActiveException

        promo = _make_promo(is_active=False)
        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=promo,
        ):
            with pytest.raises(PromoNotActiveException):
                await validate_promo(MagicMock(), "TEST10", promo.restaurant_id)

    @pytest.mark.asyncio
    async def test_expired(self):
        from features.promos.exceptions import PromoNotActiveException

        promo = _make_promo(expires_at=datetime.now(timezone.utc) - timedelta(hours=1))
        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=promo,
        ):
            with pytest.raises(PromoNotActiveException):
                await validate_promo(MagicMock(), "TEST10", promo.restaurant_id)

    @pytest.mark.asyncio
    async def test_usage_limit_reached(self):
        from features.promos.exceptions import PromoUsageLimitException

        promo = _make_promo(max_uses=5, used_count=5)
        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=promo,
        ):
            with pytest.raises(PromoUsageLimitException):
                await validate_promo(MagicMock(), "TEST10", promo.restaurant_id)

    @pytest.mark.asyncio
    async def test_percent_discount(self):
        promo = _make_promo(discount_type="PERCENT", discount_value=10)
        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=promo,
        ):
            result = await validate_promo(
                MagicMock(), "TEST10", promo.restaurant_id, order_total=1000
            )
            assert result.discounted_amount == 900

    @pytest.mark.asyncio
    async def test_flat_discount(self):
        promo = _make_promo(discount_type="FIXED", discount_value=200)
        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=promo,
        ):
            result = await validate_promo(
                MagicMock(), "TEST10", promo.restaurant_id, order_total=1000
            )
            assert result.discounted_amount == 800

    @pytest.mark.asyncio
    async def test_no_order_total(self):
        promo = _make_promo()
        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=promo,
        ):
            result = await validate_promo(MagicMock(), "TEST10", promo.restaurant_id)
            assert result.discounted_amount is None


class TestApplyPromo:
    @pytest.mark.asyncio
    async def test_not_found(self):
        from features.promos.exceptions import PromoNotFoundException

        with patch(
            "features.promos.crud.get_promo_by_code",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(PromoNotFoundException):
                await apply_promo(MagicMock(), "NOCODE", uuid.uuid4(), 1000)

    @pytest.mark.asyncio
    async def test_percent_discount(self):
        promo = _make_promo(discount_type="PERCENT", discount_value=20)
        with (
            patch(
                "features.promos.crud.get_promo_by_code",
                new_callable=AsyncMock,
                return_value=promo,
            ),
            patch("features.promos.crud.increment_used_count", new_callable=AsyncMock),
        ):
            result = await apply_promo(MagicMock(), "TEST10", promo.restaurant_id, 1000)
            assert result == 800

    @pytest.mark.asyncio
    async def test_flat_discount(self):
        promo = _make_promo(discount_type="FIXED", discount_value=300)
        with (
            patch(
                "features.promos.crud.get_promo_by_code",
                new_callable=AsyncMock,
                return_value=promo,
            ),
            patch("features.promos.crud.increment_used_count", new_callable=AsyncMock),
        ):
            result = await apply_promo(MagicMock(), "TEST10", promo.restaurant_id, 1000)
            assert result == 700

    @pytest.mark.asyncio
    async def test_discount_cannot_go_below_zero(self):
        promo = _make_promo(discount_type="FIXED", discount_value=9999)
        with (
            patch(
                "features.promos.crud.get_promo_by_code",
                new_callable=AsyncMock,
                return_value=promo,
            ),
            patch("features.promos.crud.increment_used_count", new_callable=AsyncMock),
        ):
            result = await apply_promo(MagicMock(), "TEST10", promo.restaurant_id, 100)
            assert result == 0
