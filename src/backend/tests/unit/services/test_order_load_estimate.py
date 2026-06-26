import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from features.orders.services.order import (
    _is_open_at,
    _validate_requested_pickup_at,
    estimate_restaurant_load,
)
from shared.exceptions import BadRequestException


def _restaurant(
    *,
    is_open: bool = True,
    is_ordering_paused: bool = False,
    ordering_paused_until: datetime | None = None,
    avg_prep_time_minutes: int = 15,
    max_active_orders: int | None = None,
):
    restaurant = MagicMock()
    restaurant.id = uuid.uuid4()
    restaurant.is_open = is_open
    restaurant.is_ordering_paused = is_ordering_paused
    restaurant.ordering_paused_until = ordering_paused_until
    restaurant.avg_prep_time_minutes = avg_prep_time_minutes
    restaurant.max_active_orders = max_active_orders
    return restaurant


def _working_hours_entry(
    *,
    day_of_week: int,
    open_time: str = "09:00",
    close_time: str = "21:00",
    is_closed: bool = False,
):
    entry = MagicMock()
    entry.day_of_week = day_of_week
    entry.open_time = open_time
    entry.close_time = close_time
    entry.is_closed = is_closed
    return entry


@pytest.mark.asyncio
async def test_estimate_restaurant_load_warns_with_later_window():
    restaurant = _restaurant(avg_prep_time_minutes=10, max_active_orders=20)

    with (
        patch(
            "features.restaurants.crud.get_restaurant_by_id",
            new_callable=AsyncMock,
            return_value=restaurant,
        ),
        patch(
            "features.orders.crud.order.count_active_orders_by_restaurant_id",
            new_callable=AsyncMock,
            return_value=42,
        ),
        patch(
            "features.orders.services.order.get_working_hours",
            new_callable=AsyncMock,
            return_value=[],
        ),
    ):
        estimate = await estimate_restaurant_load(AsyncMock(), restaurant.id)

    assert estimate.ordering_available is True
    assert estimate.active_orders_count == 42
    assert estimate.estimated_wait_min_minutes == 30
    assert estimate.estimated_wait_max_minutes == 40


@pytest.mark.asyncio
async def test_estimate_restaurant_load_respects_manual_pause():
    paused_until = datetime.now(timezone.utc) + timedelta(minutes=30)
    restaurant = _restaurant(is_ordering_paused=True, ordering_paused_until=paused_until)

    with (
        patch(
            "features.restaurants.crud.get_restaurant_by_id",
            new_callable=AsyncMock,
            return_value=restaurant,
        ),
        patch(
            "features.orders.crud.order.count_active_orders_by_restaurant_id",
            new_callable=AsyncMock,
            return_value=3,
        ),
        patch(
            "features.orders.services.order.get_working_hours",
            new_callable=AsyncMock,
            return_value=[],
        ),
    ):
        estimate = await estimate_restaurant_load(AsyncMock(), restaurant.id)

    assert estimate.ordering_available is False
    assert estimate.reason == "PAUSED"
    assert estimate.paused_until == paused_until


def test_validate_requested_pickup_at_accepts_later_time():
    min_ready_at = datetime.now(timezone.utc) + timedelta(minutes=20)
    requested = min_ready_at + timedelta(minutes=15)

    assert _validate_requested_pickup_at(requested, min_ready_at) == requested


def test_validate_requested_pickup_at_rejects_too_soon_time():
    min_ready_at = datetime.now(timezone.utc) + timedelta(minutes=20)
    requested = min_ready_at - timedelta(minutes=1)

    with pytest.raises(BadRequestException):
        _validate_requested_pickup_at(requested, min_ready_at)


def test_validate_requested_pickup_at_rejects_far_future_time():
    min_ready_at = datetime.now(timezone.utc) + timedelta(minutes=20)
    requested = datetime.now(timezone.utc) + timedelta(days=8)

    with pytest.raises(BadRequestException):
        _validate_requested_pickup_at(requested, min_ready_at)


def test_is_open_at_accepts_time_inside_working_hours():
    pickup_at = datetime(2026, 5, 21, 12, 30, tzinfo=timezone.utc)
    hours = [_working_hours_entry(day_of_week=pickup_at.weekday())]

    assert _is_open_at(hours, pickup_at) is True


def test_is_open_at_rejects_time_outside_working_hours():
    pickup_at = datetime(2026, 5, 21, 22, 0, tzinfo=timezone.utc)
    hours = [_working_hours_entry(day_of_week=pickup_at.weekday())]

    assert _is_open_at(hours, pickup_at) is False


def test_is_open_at_rejects_closed_day():
    pickup_at = datetime(2026, 5, 21, 12, 30, tzinfo=timezone.utc)
    hours = [_working_hours_entry(day_of_week=pickup_at.weekday(), is_closed=True)]

    assert _is_open_at(hours, pickup_at) is False
