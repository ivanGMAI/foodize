import asyncio
import json
import uuid

import jwt
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from database import db_helper
from features.orders.crud.order import get_active_orders_for_display, get_order_by_id
from features.orders.dependencies import verify_restaurant_access
from features.orders.schemas.order import OrderResponse
from features.users.dependencies import get_user_by_id
from infra.cache.redis import get_redis_cache
from shared.enums.order_status import OrderStatus
from shared.enums.permissions import Permission
from shared.permissions import has_permission
from utils.JWT import decode_jwt

router = APIRouter()


async def _authenticate_ws_user(websocket: WebSocket, token: str | None):
    if not token:
        await websocket.send_text(json.dumps({"error": "not_authenticated"}))
        await websocket.close()
        return None

    try:
        payload = decode_jwt(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise ValueError
        parsed_user_id = uuid.UUID(user_id)
    except (jwt.InvalidTokenError, ValueError):
        await websocket.send_text(json.dumps({"error": "invalid_token"}))
        await websocket.close()
        return None

    async with db_helper.session_factory() as session:
        user = await get_user_by_id(session, parsed_user_id)
        if user is None or not user.is_active:
            await websocket.send_text(json.dumps({"error": "not_authenticated"}))
            await websocket.close()
            return None
        return user


async def _can_read_order(session, order, user) -> bool:
    if has_permission(user.permissions, Permission.ORDERS_MODERATE):
        return True
    if has_permission(user.permissions, Permission.ORDERS_READ_OWN) and order.user_id == user.id:
        return True
    if has_permission(user.permissions, Permission.ORDERS_READ_RESTAURANT):
        try:
            await verify_restaurant_access(session, order.restaurant_id, user)
            return True
        except Exception:
            return False
    return False


@router.websocket("/ws/orders/{order_id}")
async def order_status_ws(
    order_id: uuid.UUID,
    websocket: WebSocket,
    token: str | None = None,
) -> None:
    await websocket.accept()
    user = await _authenticate_ws_user(websocket, token)
    if user is None:
        return

    last_status: str | None = None
    redis_client = get_redis_cache().get_raw_client()
    pubsub = redis_client.pubsub()
    channel = f"order_status:{order_id}"
    await pubsub.subscribe(channel)

    try:
        async with db_helper.session_factory() as session:
            order = await get_order_by_id(session, order_id)
            if order is None:
                await websocket.send_text(json.dumps({"error": "not_found"}))
                return
            if not await _can_read_order(session, order, user):
                await websocket.send_text(json.dumps({"error": "forbidden"}))
                await websocket.close()
                return

            last_status = str(order.status)
            data = OrderResponse.model_validate(order).model_dump(mode="json")
            await websocket.send_text(json.dumps(data))

            if last_status in (OrderStatus.COMPLETED.value, OrderStatus.CANCELLED.value):
                return

        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message is not None:
                async with db_helper.session_factory() as session:
                    order = await get_order_by_id(session, order_id)
                    if order is None:
                        break

                    current_status = str(order.status)
                    if current_status != last_status:
                        last_status = current_status
                        data = OrderResponse.model_validate(order).model_dump(mode="json")
                        await websocket.send_text(json.dumps(data))

                    if current_status in (OrderStatus.COMPLETED.value, OrderStatus.CANCELLED.value):
                        break

            try:
                client_message = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                try:
                    client_data = json.loads(client_message)
                    if client_data.get("type") == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))
                except json.JSONDecodeError:
                    pass
            except asyncio.TimeoutError:
                pass

    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel)


def _build_display_board(rows: list[tuple[int, str]]) -> dict:
    cooking_statuses = {
        OrderStatus.PENDING.value,
        OrderStatus.ACCEPTED.value,
    }
    cooking = [display_id for display_id, status in rows if status in cooking_statuses]
    ready = [display_id for display_id, status in rows if status == OrderStatus.READY.value]
    return {"cooking": cooking, "ready": ready}


@router.websocket("/ws/restaurants/{restaurant_id}/display-board")
async def display_board_ws(
    restaurant_id: uuid.UUID,
    websocket: WebSocket,
    token: str | None = None,
) -> None:
    await websocket.accept()

    if not token:
        await websocket.send_text(json.dumps({"error": "not_authenticated"}))
        await websocket.close()
        return

    try:
        payload = decode_jwt(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise ValueError
        parsed_user_id = uuid.UUID(user_id)
    except (jwt.InvalidTokenError, ValueError):
        await websocket.send_text(json.dumps({"error": "invalid_token"}))
        await websocket.close()
        return

    async with db_helper.session_factory() as session:
        user = await get_user_by_id(session, parsed_user_id)
        if user is None or not user.is_active:
            await websocket.send_text(json.dumps({"error": "not_authenticated"}))
            await websocket.close()
            return

        if not has_permission(user.permissions, Permission.DISPLAY_BOARD_VIEW):
            await websocket.send_text(json.dumps({"error": "forbidden"}))
            await websocket.close()
            return

        try:
            await verify_restaurant_access(session, restaurant_id, user)
        except Exception:
            await websocket.send_text(json.dumps({"error": "forbidden"}))
            await websocket.close()
            return

        rows = await get_active_orders_for_display(session, restaurant_id)
        await websocket.send_text(json.dumps(_build_display_board(rows)))

    redis_client = get_redis_cache().get_raw_client()
    pubsub = redis_client.pubsub()
    channel = f"restaurant_orders:{restaurant_id}"
    await pubsub.subscribe(channel)

    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message is not None:
                async with db_helper.session_factory() as session:
                    rows = await get_active_orders_for_display(session, restaurant_id)
                    await websocket.send_text(json.dumps(_build_display_board(rows)))

            try:
                client_message = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                try:
                    client_data = json.loads(client_message)
                    if client_data.get("type") == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))
                except json.JSONDecodeError:
                    pass
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel)


@router.websocket("/ws/restaurants/{restaurant_id}/orders")
async def restaurant_orders_ws(
    restaurant_id: uuid.UUID,
    websocket: WebSocket,
    token: str | None = None,
) -> None:
    await websocket.accept()

    if not token:
        await websocket.send_text(json.dumps({"error": "not_authenticated"}))
        await websocket.close()
        return

    try:
        payload = decode_jwt(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise ValueError
        parsed_user_id = uuid.UUID(user_id)
    except (jwt.InvalidTokenError, ValueError):
        await websocket.send_text(json.dumps({"error": "invalid_token"}))
        await websocket.close()
        return

    async with db_helper.session_factory() as session:
        user = await get_user_by_id(session, parsed_user_id)
        if user is None or not user.is_active:
            await websocket.send_text(json.dumps({"error": "not_authenticated"}))
            await websocket.close()
            return
        try:
            await verify_restaurant_access(session, restaurant_id, user)
        except Exception:
            await websocket.send_text(json.dumps({"error": "forbidden"}))
            await websocket.close()
            return

    redis_client = get_redis_cache().get_raw_client()
    pubsub = redis_client.pubsub()
    channel = f"restaurant_orders:{restaurant_id}"
    await pubsub.subscribe(channel)

    try:
        while True:
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message is not None:
                data_str = message["data"]
                if isinstance(data_str, bytes):
                    data_str = data_str.decode("utf-8")
                await websocket.send_text(json.dumps({"event": data_str}))

            try:
                client_message = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                try:
                    client_data = json.loads(client_message)
                    if client_data.get("type") == "ping":
                        await websocket.send_text(json.dumps({"type": "pong"}))
                except json.JSONDecodeError:
                    pass
            except asyncio.TimeoutError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        await pubsub.unsubscribe(channel)
