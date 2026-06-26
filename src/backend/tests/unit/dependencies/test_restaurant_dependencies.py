import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from features.restaurants.dependencies import get_restaurant_and_check_ownership
from shared.exceptions import RuleException
from shared.exceptions.existence import NotFoundException


class TestRestaurantDependencies:
    @pytest.mark.asyncio
    async def test_get_restaurant_and_check_ownership_404(self):
        mock_session = AsyncMock()
        mock_session.get.return_value = None

        with pytest.raises(NotFoundException):
            await get_restaurant_and_check_ownership(mock_session, uuid.uuid4(), uuid.uuid4())

    @pytest.mark.asyncio
    async def test_get_restaurant_and_check_ownership_403(self):
        mock_session = AsyncMock()
        mock_rest = MagicMock(vendor_id=uuid.uuid4())
        mock_session.get.return_value = mock_rest

        with pytest.raises(RuleException):
            await get_restaurant_and_check_ownership(mock_session, uuid.uuid4(), uuid.uuid4())
