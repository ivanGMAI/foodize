from fastapi import APIRouter

from features.admin.api import router as admin_router
from features.ai_advisor.api import router as ai_advisor_router
from features.ai_order_agent.api import router as ai_order_router
from features.auth.api import router as auth_router
from features.cart.api import router as cart_router
from features.favorites.api import router as favorites_router
from features.menu.api import router as menu_router
from features.notifications.api import router as notifications_router
from features.notifications.ws import router as notifications_ws_router
from features.orders.router import router as order_router
from features.promos.api import router as promos_router
from features.restaurants.api import router as restaurant_router
from features.reviews.api import router as reviews_router
from features.staff.api import router as staff_router
from features.telegram.api import router as telegram_router
from features.users.api import router as user_router
from features.vendors.api import router as vendor_router
from settings.config.app_config import settings

router = APIRouter(
    prefix=settings.api.v1.prefix,
)

router.include_router(admin_router)
router.include_router(ai_advisor_router)
router.include_router(ai_order_router)
router.include_router(cart_router)
router.include_router(promos_router)
router.include_router(auth_router)
router.include_router(favorites_router)
router.include_router(staff_router)
router.include_router(vendor_router)
router.include_router(restaurant_router)
router.include_router(menu_router)
router.include_router(order_router)
router.include_router(reviews_router)
router.include_router(telegram_router)
router.include_router(user_router)
router.include_router(notifications_router)
router.include_router(notifications_ws_router)
