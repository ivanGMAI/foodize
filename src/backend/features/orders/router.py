from fastapi import APIRouter

from features.orders.api.order import router as order_router
from features.orders.api.ws import router as order_ws_router

router = APIRouter()
router.include_router(order_router)
router.include_router(order_ws_router)
