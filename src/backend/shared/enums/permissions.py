import enum


class Permission(enum.Enum):
    ADMIN_ACCESS = "admin.access"

    USERS_READ = "users.read"
    USERS_MANAGE = "users.manage"
    USERS_ASSIGN_PERMISSIONS = "users.assign_permissions"

    RESTAURANTS_READ = "restaurants.read"
    RESTAURANTS_CREATE = "restaurants.create"
    RESTAURANTS_UPDATE = "restaurants.update"
    RESTAURANTS_MODERATE = "restaurants.moderate"

    MENU_READ = "menu.read"
    MENU_MANAGE = "menu.manage"

    CART_MANAGE = "cart.manage"
    FAVORITES_MANAGE = "favorites.manage"

    ORDERS_CREATE = "orders.create"
    ORDERS_READ_OWN = "orders.read_own"
    ORDERS_READ_RESTAURANT = "orders.read_restaurant"
    ORDERS_MANAGE_STATUS = "orders.manage_status"
    ORDERS_MODERATE = "orders.moderate"

    REVIEWS_CREATE = "reviews.create"
    REVIEWS_READ = "reviews.read"
    REVIEWS_MODERATE = "reviews.moderate"

    PROMOS_VALIDATE = "promos.validate"
    PROMOS_MANAGE = "promos.manage"

    VENDORS_CREATE = "vendors.create"
    VENDORS_READ_OWN = "vendors.read_own"
    VENDORS_ANALYTICS_READ = "vendors.analytics_read"
    VENDORS_MODERATE = "vendors.moderate"

    STAFF_REQUESTS_CREATE = "staff.requests_create"
    STAFF_REQUESTS_MANAGE = "staff.requests_manage"
    STAFF_MEMBERS_MANAGE = "staff.members_manage"
    STAFF_PROFILE_READ = "staff.profile_read"

    TELEGRAM_AUTH = "telegram.auth"

    DISPLAY_BOARD_VIEW = "display_board.view"
