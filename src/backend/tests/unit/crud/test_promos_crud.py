import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.promos.crud import (
    count_promos_by_restaurant_ids,
    create_promo,
    deactivate_promo,
    get_promo_by_code,
    get_promos_by_restaurant_ids,
    increment_used_count,
)


class TestGetPromoByCode:
    @pytest.mark.asyncio
    async def test_found(self):
        promo = MagicMock()
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=promo)

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await get_promo_by_code(session, "TEST10")
        assert result == promo

    @pytest.mark.asyncio
    async def test_not_found(self):
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = MagicMock(return_value=None)

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await get_promo_by_code(session, "NOCODE")
        assert result is None


class TestGetPromosByRestaurantIds:
    @pytest.mark.asyncio
    async def test_empty_ids_returns_empty(self):
        session = AsyncMock()
        result = await get_promos_by_restaurant_ids(session, [])
        assert result == []
        session.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_with_ids(self):
        promo = MagicMock()
        mock_result = MagicMock()
        mock_result.scalars = MagicMock(return_value=MagicMock(all=MagicMock(return_value=[promo])))

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await get_promos_by_restaurant_ids(session, [uuid.uuid4()])
        assert result == [promo]


class TestCountPromosByRestaurantIds:
    @pytest.mark.asyncio
    async def test_empty_ids_returns_zero(self):
        session = AsyncMock()
        result = await count_promos_by_restaurant_ids(session, [])
        assert result == 0
        session.execute.assert_not_called()

    @pytest.mark.asyncio
    async def test_with_ids(self):
        mock_result = MagicMock()
        mock_result.scalar_one = MagicMock(return_value=5)

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await count_promos_by_restaurant_ids(session, [uuid.uuid4()])
        assert result == 5


class TestCreatePromo:
    @pytest.mark.asyncio
    async def test_creates_and_returns(self):
        from features.promos.schemas import PromoCreate

        data = PromoCreate(
            code="save20",
            discount_type="PERCENT",
            discount_value=20,
            restaurant_id=uuid.uuid4(),
        )

        session = AsyncMock()
        session.add = MagicMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()

        with patch("features.promos.crud.Promo") as MockPromo:
            mock_promo = MagicMock()
            MockPromo.return_value = mock_promo
            result = await create_promo(session, data)
            session.add.assert_called_once_with(mock_promo)
            session.commit.assert_awaited_once()
            session.refresh.assert_awaited_once_with(mock_promo)
            assert result == mock_promo


class TestDeactivatePromo:
    @pytest.mark.asyncio
    async def test_deactivates_and_returns(self):
        promo = MagicMock()
        promo.is_active = True

        session = AsyncMock()
        session.commit = AsyncMock()
        session.refresh = AsyncMock()

        await deactivate_promo(session, promo)
        assert promo.is_active is False
        session.commit.assert_awaited_once()
        session.refresh.assert_awaited_once_with(promo)


class TestIncrementUsedCount:
    @pytest.mark.asyncio
    async def test_increments_and_commits(self):
        promo = MagicMock()
        promo.used_count = 3

        mock_result = MagicMock()
        mock_result.rowcount = 1

        session = AsyncMock()
        session.execute = AsyncMock(return_value=mock_result)

        result = await increment_used_count(session, promo)
        assert result is True
        session.execute.assert_awaited_once()
