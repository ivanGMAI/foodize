import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from factories import make_user

from features.orders.exceptions import (
    MenuItemRestaurantMismatchException,
    MenuItemsNotFoundException,
    OrderAccessDeniedException,
    OrderNotCancellableException,
    OrderNotFoundException,
)
from features.orders.schemas.order import (
    OrderCancelRequest,
    OrderCreate,
    OrderLoadEstimate,
    OrderResponse,
)
from features.orders.schemas.order_item import OrderItemCreate
from features.orders.services.order import (
    cancel_order,
    get_order,
    get_user_orders,
    place_order,
)
from features.restaurants.exceptions import (
    RestaurantClosedException,
    RestaurantNotFoundException,
)
from shared.enums.order_status import OrderStatus
from shared.exceptions import BadRequestException


def make_mock_menu_item(
    item_id: uuid.UUID, price: int = 500, restaurant_id: uuid.UUID | None = None
):
    item = MagicMock()
    item.id = item_id
    item.price = price
    item.restaurant_id = restaurant_id or uuid.uuid4()
    item.is_available = True
    item.prep_time_minutes = 10
    item.option_groups = []
    return item


def make_mock_restaurant(restaurant_id: uuid.UUID, is_open: bool = True):
    r = MagicMock()
    r.id = restaurant_id
    r.is_open = is_open
    r.is_ordering_paused = False
    r.ordering_paused_until = None
    r.avg_prep_time_minutes = 15
    r.max_active_orders = None
    return r


def make_mock_order(
    order_id: uuid.UUID, user_id: uuid.UUID, status: str = OrderStatus.PENDING.value
):
    order = MagicMock()
    order.id = order_id
    order.display_id = 1001
    order.user_id = user_id
    order.restaurant_id = uuid.uuid4()
    order.status = status
    order.total_price = 500
    order.comment = None
    order.cancellation_reason = None
    order.requested_pickup_at = None
    order.created_at = "2026-01-01T00:00:00+00:00"
    order.estimated_ready_at = None
    order.ready_at = None
    order.items = []
    order.user = None
    order.restaurant = MagicMock()
    order.restaurant.display_id = "test-restaurant"
    order.restaurant.name = "Test Restaurant"
    order.restaurant.address = "Test Address"
    return order


def make_load_estimate(restaurant_id: uuid.UUID) -> OrderLoadEstimate:
    return OrderLoadEstimate(
        restaurant_id=restaurant_id,
        ordering_available=True,
        active_orders_count=0,
        avg_prep_time_minutes=15,
        estimated_wait_min_minutes=15,
        estimated_wait_max_minutes=30,
    )


class TestPlaceOrder:
    async def test_place_order_success(self, mock_db_session):
        user = make_user()
        item_id = uuid.uuid4()
        restaurant_id = uuid.uuid4()
        order_data = OrderCreate(
            restaurant_id=restaurant_id,
            items=[OrderItemCreate(menu_item_id=item_id, quantity=2)],
        )
        mock_order = make_mock_order(uuid.uuid4(), user.id)
        mock_menu_item = make_mock_menu_item(item_id, price=300, restaurant_id=restaurant_id)
        mock_restaurant = make_mock_restaurant(restaurant_id)
        mock_restaurant.name = "Test Restaurant"

        with (
            patch(
                "features.restaurants.crud.get_restaurant_by_id",
                new_callable=AsyncMock,
                return_value=mock_restaurant,
            ),
            patch(
                "features.orders.crud.order_item.get_menu_items_by_ids",
                new_callable=AsyncMock,
                return_value={item_id: mock_menu_item},
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
                "features.orders.crud.order.get_order_by_id",
                new_callable=AsyncMock,
                return_value=mock_order,
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
            result = await place_order(mock_db_session, order_data, user.id)

        assert isinstance(result, OrderResponse)
        assert result.id == mock_order.id

    async def test_place_order_restaurant_not_found(self, mock_db_session):
        order_data = OrderCreate(
            restaurant_id=uuid.uuid4(),
            items=[OrderItemCreate(menu_item_id=uuid.uuid4(), quantity=1)],
        )
        with patch(
            "features.restaurants.crud.get_restaurant_by_id",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(RestaurantNotFoundException):
                await place_order(mock_db_session, order_data, uuid.uuid4())

    async def test_place_order_restaurant_closed(self, mock_db_session):
        restaurant_id = uuid.uuid4()
        order_data = OrderCreate(
            restaurant_id=restaurant_id,
            items=[OrderItemCreate(menu_item_id=uuid.uuid4(), quantity=1)],
        )
        with patch(
            "features.restaurants.crud.get_restaurant_by_id",
            new_callable=AsyncMock,
            return_value=make_mock_restaurant(restaurant_id, is_open=False),
        ):
            with pytest.raises(RestaurantClosedException):
                await place_order(mock_db_session, order_data, uuid.uuid4())

    async def test_place_order_item_wrong_restaurant(self, mock_db_session):
        restaurant_id = uuid.uuid4()
        item_id = uuid.uuid4()
        order_data = OrderCreate(
            restaurant_id=restaurant_id,
            items=[OrderItemCreate(menu_item_id=item_id, quantity=1)],
        )
        wrong_restaurant_item = make_mock_menu_item(item_id, restaurant_id=uuid.uuid4())

        with (
            patch(
                "features.restaurants.crud.get_restaurant_by_id",
                new_callable=AsyncMock,
                return_value=make_mock_restaurant(restaurant_id),
            ),
            patch(
                "features.orders.crud.order_item.get_menu_items_by_ids",
                new_callable=AsyncMock,
                return_value={item_id: wrong_restaurant_item},
            ),
            patch(
                "features.orders.services.order.get_working_hours",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            with pytest.raises(MenuItemRestaurantMismatchException):
                await place_order(mock_db_session, order_data, uuid.uuid4())

    async def test_place_order_missing_menu_items_raises_422(self, mock_db_session):
        restaurant_id = uuid.uuid4()
        item_id_1 = uuid.uuid4()
        item_id_2 = uuid.uuid4()
        order_data = OrderCreate(
            restaurant_id=restaurant_id,
            items=[
                OrderItemCreate(menu_item_id=item_id_1, quantity=1),
                OrderItemCreate(menu_item_id=item_id_2, quantity=1),
            ],
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
                return_value={item_id_1: make_mock_menu_item(item_id_1)},
            ),
            patch(
                "features.orders.services.order.get_working_hours",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            with pytest.raises(MenuItemsNotFoundException):
                await place_order(mock_db_session, order_data, uuid.uuid4())

    async def test_place_order_all_items_missing(self, mock_db_session):
        restaurant_id = uuid.uuid4()
        order_data = OrderCreate(
            restaurant_id=restaurant_id,
            items=[OrderItemCreate(menu_item_id=uuid.uuid4(), quantity=1)],
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
                return_value={},
            ),
            patch(
                "features.orders.services.order.get_working_hours",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            with pytest.raises(MenuItemsNotFoundException):
                await place_order(mock_db_session, order_data, uuid.uuid4())

    async def test_place_order_empty_items(self, mock_db_session):
        restaurant_id = uuid.uuid4()
        with pytest.raises(Exception):
            OrderCreate(restaurant_id=restaurant_id, items=[])

    async def test_selected_options_are_validated_and_passed_to_create_order(self, mock_db_session):
        user = make_user()
        item_id = uuid.uuid4()
        option_id = uuid.uuid4()
        group_id = uuid.uuid4()
        restaurant_id = uuid.uuid4()
        order_data = OrderCreate(
            restaurant_id=restaurant_id,
            items=[
                OrderItemCreate(
                    menu_item_id=item_id,
                    quantity=2,
                    selected_option_ids=[option_id],
                )
            ],
        )
        mock_order = make_mock_order(uuid.uuid4(), user.id)
        mock_menu_item = make_mock_menu_item(item_id, price=300, restaurant_id=restaurant_id)
        mock_group = MagicMock()
        mock_group.id = group_id
        mock_group.name = "Extras"
        mock_group.menu_item_id = item_id
        mock_group.selection_type = "multiple"
        mock_group.is_required = False
        mock_group.min_selected = 0
        mock_group.max_selected = 2
        mock_group.is_active = True
        mock_menu_item.option_groups = [mock_group]
        mock_option = MagicMock()
        mock_option.id = option_id
        mock_option.group_id = group_id
        mock_option.name = "Cheese"
        mock_option.price_delta = 50
        mock_option.is_available = True
        mock_option.group = mock_group
        mock_restaurant = make_mock_restaurant(restaurant_id)
        mock_restaurant.name = "Test Restaurant"

        with (
            patch(
                "features.restaurants.crud.get_restaurant_by_id",
                new_callable=AsyncMock,
                return_value=mock_restaurant,
            ),
            patch(
                "features.orders.crud.order_item.get_menu_items_by_ids",
                new_callable=AsyncMock,
                return_value={item_id: mock_menu_item},
            ),
            patch(
                "features.orders.crud.order_item.get_options_by_ids",
                new_callable=AsyncMock,
                return_value={option_id: mock_option},
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
            ) as create_order_mock,
            patch(
                "features.orders.crud.order.get_order_by_id",
                new_callable=AsyncMock,
                return_value=mock_order,
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
            await place_order(mock_db_session, order_data, user.id)

        selected_options_by_item = create_order_mock.call_args.args[4]
        assert selected_options_by_item[0] == [mock_option]

    async def test_selected_option_from_other_item_rejected(self, mock_db_session):
        item_id = uuid.uuid4()
        option_id = uuid.uuid4()
        restaurant_id = uuid.uuid4()
        order_data = OrderCreate(
            restaurant_id=restaurant_id,
            items=[OrderItemCreate(menu_item_id=item_id, selected_option_ids=[option_id])],
        )
        mock_menu_item = make_mock_menu_item(item_id, restaurant_id=restaurant_id)
        mock_menu_item.option_groups = []
        mock_group = MagicMock()
        mock_group.menu_item_id = uuid.uuid4()
        mock_group.is_active = True
        mock_option = MagicMock()
        mock_option.id = option_id
        mock_option.group_id = uuid.uuid4()
        mock_option.is_available = True
        mock_option.group = mock_group

        with (
            patch(
                "features.restaurants.crud.get_restaurant_by_id",
                new_callable=AsyncMock,
                return_value=make_mock_restaurant(restaurant_id),
            ),
            patch(
                "features.orders.crud.order_item.get_menu_items_by_ids",
                new_callable=AsyncMock,
                return_value={item_id: mock_menu_item},
            ),
            patch(
                "features.orders.crud.order_item.get_options_by_ids",
                new_callable=AsyncMock,
                return_value={option_id: mock_option},
            ),
            patch(
                "features.orders.services.order.get_working_hours",
                new_callable=AsyncMock,
                return_value=[],
            ),
        ):
            with pytest.raises(BadRequestException):
                await place_order(mock_db_session, order_data, uuid.uuid4())


class TestGetOrder:
    async def test_get_order_success(self, mock_db_session):
        user_id = uuid.uuid4()
        order_id = uuid.uuid4()
        mock_order = make_mock_order(order_id, user_id)

        with patch(
            "features.orders.crud.order.get_order_by_id",
            new_callable=AsyncMock,
            return_value=mock_order,
        ):
            result = await get_order(mock_db_session, order_id, user_id)

        assert isinstance(result, OrderResponse)
        assert result.id == order_id

    async def test_get_order_not_found_raises_404(self, mock_db_session):
        with patch(
            "features.orders.crud.order.get_order_by_id",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(OrderNotFoundException):
                await get_order(mock_db_session, uuid.uuid4(), uuid.uuid4())

    async def test_get_order_wrong_user_raises_403(self, mock_db_session):
        owner_id = uuid.uuid4()
        other_user_id = uuid.uuid4()
        order_id = uuid.uuid4()
        mock_order = make_mock_order(order_id, owner_id)

        with patch(
            "features.orders.crud.order.get_order_by_id",
            new_callable=AsyncMock,
            return_value=mock_order,
        ):
            with pytest.raises(OrderAccessDeniedException):
                await get_order(mock_db_session, order_id, other_user_id)


class TestGetUserOrders:
    async def test_returns_list(self, mock_db_session):
        user_id = uuid.uuid4()
        orders = [make_mock_order(uuid.uuid4(), user_id) for _ in range(3)]

        with (
            patch(
                "features.orders.crud.order.get_orders_by_user_id",
                new_callable=AsyncMock,
                return_value=orders,
            ),
            patch(
                "features.orders.crud.order.count_orders_by_user_id",
                new_callable=AsyncMock,
                return_value=3,
            ),
        ):
            data, total = await get_user_orders(mock_db_session, user_id)

        assert len(data) == 3
        assert total == 3
        assert all(isinstance(o, OrderResponse) for o in data)

    async def test_returns_empty_list(self, mock_db_session):
        with (
            patch(
                "features.orders.crud.order.get_orders_by_user_id",
                new_callable=AsyncMock,
                return_value=[],
            ),
            patch(
                "features.orders.crud.order.count_orders_by_user_id",
                new_callable=AsyncMock,
                return_value=0,
            ),
        ):
            data, total = await get_user_orders(mock_db_session, uuid.uuid4())

        assert data == []
        assert total == 0


class TestCancelOrder:
    async def test_cancel_pending_success(self, mock_db_session):
        user_id = uuid.uuid4()
        order_id = uuid.uuid4()
        mock_order = make_mock_order(order_id, user_id, OrderStatus.PENDING.value)
        cancelled = make_mock_order(order_id, user_id, OrderStatus.CANCELLED.value)

        with (
            patch(
                "features.orders.crud.order.get_order_by_identifier",
                new_callable=AsyncMock,
                return_value=mock_order,
            ),
            patch(
                "features.orders.crud.order.update_order_status",
                new_callable=AsyncMock,
                return_value=cancelled,
            ) as mock_cancel,
            patch(
                "features.orders.crud.order.create_order_event",
                new_callable=AsyncMock,
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
            result = await cancel_order(mock_db_session, order_id, user_id, OrderCancelRequest())

        mock_cancel.assert_awaited_once()
        assert isinstance(result, OrderResponse)

    async def test_cancel_wrong_user_raises(self, mock_db_session):
        owner_id = uuid.uuid4()
        other_id = uuid.uuid4()
        order_id = uuid.uuid4()
        mock_order = make_mock_order(order_id, owner_id, OrderStatus.PENDING.value)

        with patch(
            "features.orders.crud.order.get_order_by_identifier",
            new_callable=AsyncMock,
            return_value=mock_order,
        ):
            with pytest.raises(OrderAccessDeniedException):
                await cancel_order(mock_db_session, order_id, other_id, OrderCancelRequest())

    async def test_cancel_non_pending_raises(self, mock_db_session):
        user_id = uuid.uuid4()
        order_id = uuid.uuid4()
        mock_order = make_mock_order(order_id, user_id, OrderStatus.COMPLETED.value)

        with patch(
            "features.orders.crud.order.get_order_by_identifier",
            new_callable=AsyncMock,
            return_value=mock_order,
        ):
            with pytest.raises(OrderNotCancellableException):
                await cancel_order(mock_db_session, order_id, user_id, OrderCancelRequest())

    async def test_cancel_not_found_raises(self, mock_db_session):
        with patch(
            "features.orders.crud.order.get_order_by_identifier",
            new_callable=AsyncMock,
            return_value=None,
        ):
            with pytest.raises(OrderNotFoundException):
                await cancel_order(
                    mock_db_session, uuid.uuid4(), uuid.uuid4(), OrderCancelRequest()
                )
