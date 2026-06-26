import uuid
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from factories import make_user

from features.orders.exceptions import (
    InvalidStatusTransitionException,
    MenuItemUnavailableException,
    OrderAccessDeniedException,
    OrderNotCompletableException,
    OrderNotFoundException,
)
from features.orders.schemas.order import (
    OrderCreate,
    OrderLoadEstimate,
    OrderResponse,
    OrderStatusUpdate,
)
from features.orders.schemas.order_item import OrderItemCreate
from features.orders.services.order import (
    _create_order,
    change_order_status,
    complete_order,
    get_order_events,
    get_restaurant_orders,
    place_order,
)
from shared.enums.order_status import OrderStatus


def make_mock_menu_item(item_id, price=500, restaurant_id=None, is_available=True):
    item = MagicMock()
    item.id = item_id
    item.price = price
    item.restaurant_id = restaurant_id or uuid.uuid4()
    item.is_available = is_available
    item.prep_time_minutes = 10
    item.option_groups = []
    return item


def make_mock_restaurant(restaurant_id, is_open=True):
    r = MagicMock()
    r.id = restaurant_id
    r.is_open = is_open
    r.name = "Test Restaurant"
    r.is_ordering_paused = False
    r.ordering_paused_until = None
    r.avg_prep_time_minutes = 15
    r.max_active_orders = None
    return r


def make_mock_order(order_id=None, user_id=None, status=OrderStatus.PENDING.value):
    order = MagicMock()
    order.id = order_id or uuid.uuid4()
    order.display_id = 1001
    order.user_id = user_id or uuid.uuid4()
    order.restaurant_id = uuid.uuid4()
    order.status = status
    order.total_price = 500
    order.comment = None
    order.cancellation_reason = None
    order.requested_pickup_at = None
    order.estimated_ready_at = None
    order.ready_at = None
    order.created_at = datetime.now()
    order.items = []
    order.user = None
    order.restaurant = MagicMock()
    order.restaurant.display_id = "test-restaurant"
    order.restaurant.name = "Test Restaurant"
    order.restaurant.address = "Test Address"
    return order


def make_mock_event(order_id=None):
    e = MagicMock()
    e.id = uuid.uuid4()
    e.order_id = order_id or uuid.uuid4()
    e.actor_id = uuid.uuid4()
    e.actor_permissions = []
    e.old_status = OrderStatus.PENDING
    e.new_status = OrderStatus.ACCEPTED
    e.created_at = datetime.now()
    return e


def make_load_estimate(restaurant_id: uuid.UUID) -> OrderLoadEstimate:
    return OrderLoadEstimate(
        restaurant_id=restaurant_id,
        ordering_available=True,
        active_orders_count=0,
        avg_prep_time_minutes=15,
        estimated_wait_min_minutes=15,
        estimated_wait_max_minutes=30,
    )


class TestPlaceOrderExtended:
    async def test_item_unavailable_raises(self, mock_db_session):
        restaurant_id = uuid.uuid4()
        item_id = uuid.uuid4()
        order_data = OrderCreate(
            restaurant_id=restaurant_id,
            items=[OrderItemCreate(menu_item_id=item_id, quantity=1)],
        )
        unavailable_item = make_mock_menu_item(
            item_id, restaurant_id=restaurant_id, is_available=False
        )

        with (
            patch(
                "features.restaurants.crud.get_restaurant_by_id",
                new_callable=AsyncMock,
                return_value=make_mock_restaurant(restaurant_id),
            ),
            patch(
                "features.orders.crud.order_item.get_menu_items_by_ids",
                new_callable=AsyncMock,
                return_value={item_id: unavailable_item},
            ),
            patch(
                "features.orders.services.order.get_working_hours",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            with pytest.raises(MenuItemUnavailableException):
                await place_order(mock_db_session, order_data, uuid.uuid4())

    async def test_with_promo_code_applies_discount(self, mock_db_session):
        user = make_user()
        restaurant_id = uuid.uuid4()
        item_id = uuid.uuid4()
        order_data = OrderCreate(
            restaurant_id=restaurant_id,
            items=[OrderItemCreate(menu_item_id=item_id, quantity=1)],
            promo_code="SAVE10",
        )
        mock_order = make_mock_order(uuid.uuid4(), user.id)
        mock_order.total_price = 1000
        discounted_order = make_mock_order(mock_order.id, user.id)
        discounted_order.total_price = 900

        session = mock_db_session

        with (
            patch(
                "features.restaurants.crud.get_restaurant_by_id",
                new_callable=AsyncMock,
                return_value=make_mock_restaurant(restaurant_id),
            ),
            patch(
                "features.orders.crud.order_item.get_menu_items_by_ids",
                new_callable=AsyncMock,
                return_value={item_id: make_mock_menu_item(item_id, restaurant_id=restaurant_id)},
            ),
            patch(
                "features.orders.crud.order_item.get_options_by_ids",
                new_callable=AsyncMock,
                return_value={},
            ),
            patch(
                "features.orders.services.order.get_working_hours",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "features.orders.crud.order.count_orders_by_user_id",
                new_callable=AsyncMock,
                return_value=0,
            ),
            patch(
                "features.orders.services.order.estimate_restaurant_load",
                new_callable=AsyncMock,
                return_value=make_load_estimate(restaurant_id),
            ),
            patch(
                "features.orders.services.order._create_order",
                new_callable=AsyncMock,
                return_value=mock_order,
            ),
            patch(
                "features.promos.service.apply_promo",
                new_callable=AsyncMock,
                return_value=900,
            ),
            patch(
                "features.orders.crud.order.get_order_by_id",
                new_callable=AsyncMock,
                return_value=discounted_order,
            ),
            patch(
                "features.orders.services.order.enqueue_event",
                new_callable=AsyncMock,
            ),
            patch(
                "features.orders.services.order.get_redis_cache",
                return_value=MagicMock(publish=AsyncMock()),
            ),
        ):
            session.commit = AsyncMock()
            session.refresh = AsyncMock(side_effect=lambda o: None)
            result = await place_order(session, order_data, user.id)

        assert isinstance(result, OrderResponse)


class TestGetRestaurantOrders:
    async def test_success(self, mock_db_session):
        restaurant_id = uuid.uuid4()
        order = make_mock_order()

        with (
            patch(
                "features.orders.crud.order.get_orders_by_restaurant_id",
                new_callable=AsyncMock,
                return_value=[order],
            ),
            patch(
                "features.orders.crud.order.count_orders_by_restaurant_id",
                new_callable=AsyncMock,
                return_value=1,
            ),
        ):
            data, total = await get_restaurant_orders(mock_db_session, restaurant_id)
            assert len(data) == 1
            assert total == 1

    async def test_empty(self, mock_db_session):
        with (
            patch(
                "features.orders.crud.order.get_orders_by_restaurant_id",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "features.orders.crud.order.count_orders_by_restaurant_id",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            data, total = await get_restaurant_orders(mock_db_session, uuid.uuid4())
            assert data == []
            assert total == 0


class TestChangeOrderStatus:
    async def test_success(self, mock_db_session):
        user = make_user()
        order = make_mock_order(status=OrderStatus.PENDING.value)
        updated_order = make_mock_order(
            order_id=order.id, user_id=order.user_id, status=OrderStatus.ACCEPTED.value
        )
        status_data = OrderStatusUpdate(status=OrderStatus.ACCEPTED, estimated_ready_in_minutes=15)

        with (
            patch(
                "features.orders.crud.order.update_order_status",
                new_callable=AsyncMock,
                return_value=updated_order,
            ),
            patch("features.orders.crud.order.create_order_event", new_callable=AsyncMock),
            patch("features.orders.services.order.enqueue_event", new_callable=AsyncMock),
            patch(
                "features.orders.services.order.get_redis_cache",
                return_value=MagicMock(publish=AsyncMock()),
            ),
        ):
            result = await change_order_status(mock_db_session, order, status_data, user)
            assert result.status == OrderStatus.ACCEPTED

    async def test_invalid_transition_raises(self, mock_db_session):
        user = make_user()
        order = make_mock_order(status=OrderStatus.COMPLETED.value)
        status_data = OrderStatusUpdate(status=OrderStatus.PENDING)

        with pytest.raises(InvalidStatusTransitionException):
            await change_order_status(mock_db_session, order, status_data, user)


class TestCompleteOrder:
    async def test_success(self, mock_db_session):
        user_id = uuid.uuid4()
        order = make_mock_order(user_id=user_id, status=OrderStatus.READY.value)
        completed_order = make_mock_order(
            order_id=order.id, user_id=user_id, status=OrderStatus.COMPLETED.value
        )

        with (
            patch(
                "features.orders.crud.order.get_order_by_identifier",
                new_callable=AsyncMock,
                return_value=order,
            ),
            patch(
                "features.orders.crud.order.update_order_status",
                new_callable=AsyncMock,
                return_value=completed_order,
            ),
            patch("features.orders.crud.order.create_order_event", new_callable=AsyncMock),
            patch("features.orders.services.order.enqueue_event", new_callable=AsyncMock),
            patch(
                "features.orders.services.order.get_redis_cache",
                return_value=MagicMock(publish=AsyncMock()),
            ),
        ):
            result = await complete_order(mock_db_session, order.id, user_id)
            assert result.status == OrderStatus.COMPLETED

    async def test_not_completable_status(self, mock_db_session):
        user_id = uuid.uuid4()
        order = make_mock_order(user_id=user_id, status=OrderStatus.PENDING.value)

        with patch(
            "features.orders.crud.order.get_order_by_identifier",
            new_callable=AsyncMock,
            return_value=order,
        ):
            with pytest.raises(OrderNotCompletableException):
                await complete_order(mock_db_session, order.id, user_id)

    async def test_not_found(self, mock_db_session):
        with patch(
            "features.orders.crud.order.get_order_by_identifier",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(OrderNotFoundException):
                await complete_order(mock_db_session, uuid.uuid4(), uuid.uuid4())

    async def test_access_denied(self, mock_db_session):
        user_id = uuid.uuid4()
        order = make_mock_order(user_id=uuid.uuid4(), status=OrderStatus.READY.value)

        with patch(
            "features.orders.crud.order.get_order_by_identifier",
            new_callable=AsyncMock,
            return_value=order,
        ):
            with pytest.raises(OrderAccessDeniedException):
                await complete_order(mock_db_session, order.id, user_id)


class TestCreateOrder:
    async def test_success(self, mock_db_session):
        user_id = uuid.uuid4()
        restaurant_id = uuid.uuid4()
        item_id = uuid.uuid4()

        order_data = OrderCreate(
            restaurant_id=restaurant_id,
            items=[OrderItemCreate(menu_item_id=item_id, quantity=2)],
        )

        menu_item_mock = MagicMock()
        menu_item_mock.price = 300

        session = mock_db_session
        session.add = MagicMock()
        session.flush = AsyncMock()
        session.commit = AsyncMock()

        result = await _create_order(
            session, order_data, user_id, {item_id: menu_item_mock}, {0: []}
        )

        assert result.user_id == user_id
        assert result.restaurant_id == restaurant_id
        assert result.total_price == 600

    async def test_sets_selected_options_snapshots(self, mock_db_session):
        user_id = uuid.uuid4()
        restaurant_id = uuid.uuid4()
        item_id = uuid.uuid4()
        option_id = uuid.uuid4()

        order_data = OrderCreate(
            restaurant_id=restaurant_id,
            items=[OrderItemCreate(menu_item_id=item_id, quantity=1)],
        )

        menu_item_mock = MagicMock()
        menu_item_mock.price = 100
        option_mock = MagicMock()
        option_mock.id = option_id
        option_mock.name = "Cheese"
        option_mock.price_delta = 25

        session = mock_db_session
        session.add = MagicMock()
        session.flush = AsyncMock()
        session.commit = AsyncMock()

        result = await _create_order(
            session, order_data, user_id, {item_id: menu_item_mock}, {0: [option_mock]}
        )

        assert result.total_price == 125
        assert session.add.call_count >= 3


class TestGetOrderEvents:
    async def test_success(self, mock_db_session):
        order_id = uuid.uuid4()
        event = make_mock_event(order_id)

        with patch(
            "features.orders.crud.order.get_events_by_order_id",
            new_callable=AsyncMock,
            return_value=[event],
        ):
            result = await get_order_events(mock_db_session, order_id)
            assert len(result) == 1

    async def test_empty(self, mock_db_session):
        with patch(
            "features.orders.crud.order.get_events_by_order_id",
            new_callable=AsyncMock,
            return_value=[],
        ):
            result = await get_order_events(mock_db_session, uuid.uuid4())
            assert result == []
