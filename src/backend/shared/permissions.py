from collections.abc import Iterable

from shared.enums.permissions import Permission

CUSTOMER_PERMISSIONS: frozenset[Permission] = frozenset(
    {
        Permission.RESTAURANTS_READ,
        Permission.MENU_READ,
        Permission.CART_MANAGE,
        Permission.FAVORITES_MANAGE,
        Permission.ORDERS_CREATE,
        Permission.ORDERS_READ_OWN,
        Permission.REVIEWS_CREATE,
        Permission.REVIEWS_READ,
        Permission.PROMOS_VALIDATE,
        Permission.STAFF_REQUESTS_CREATE,
        Permission.TELEGRAM_AUTH,
    }
)

VENDOR_PERMISSIONS: frozenset[Permission] = frozenset(
    {
        Permission.RESTAURANTS_CREATE,
        Permission.RESTAURANTS_UPDATE,
        Permission.MENU_MANAGE,
        Permission.ORDERS_READ_RESTAURANT,
        Permission.ORDERS_MANAGE_STATUS,
        Permission.PROMOS_MANAGE,
        Permission.VENDORS_CREATE,
        Permission.VENDORS_READ_OWN,
        Permission.VENDORS_ANALYTICS_READ,
        Permission.STAFF_REQUESTS_MANAGE,
        Permission.STAFF_MEMBERS_MANAGE,
        Permission.STAFF_PROFILE_READ,
        Permission.DISPLAY_BOARD_VIEW,
    }
)

STAFF_PERMISSIONS: frozenset[Permission] = frozenset(
    {
        Permission.ORDERS_READ_RESTAURANT,
        Permission.ORDERS_MANAGE_STATUS,
        Permission.STAFF_PROFILE_READ,
        Permission.DISPLAY_BOARD_VIEW,
    }
)

ADMIN_PERMISSIONS: frozenset[Permission] = frozenset(Permission)


def _coerce_permission(value: Permission | str) -> Permission | None:
    if isinstance(value, Permission):
        return value
    try:
        return Permission(value)
    except ValueError:
        return None


def normalize_permissions(
    permissions: Iterable[Permission | str] | None,
) -> frozenset[Permission]:
    if permissions is None:
        return frozenset()
    normalized = {_coerce_permission(permission) for permission in permissions}
    return frozenset(permission for permission in normalized if permission is not None)


def serialize_permissions(permissions: Iterable[Permission | str] | None) -> list[str]:
    return sorted(permission.value for permission in normalize_permissions(permissions))


def permissions_with(
    current: Iterable[Permission | str] | None,
    additions: Iterable[Permission | str],
) -> list[str]:
    return serialize_permissions(normalize_permissions(current) | normalize_permissions(additions))


def permissions_without(
    current: Iterable[Permission | str] | None,
    removals: Iterable[Permission | str],
) -> list[str]:
    return serialize_permissions(normalize_permissions(current) - normalize_permissions(removals))


def has_permission(permissions: Iterable[Permission | str] | None, permission: Permission) -> bool:
    normalized = normalize_permissions(permissions)
    return permission in normalized or Permission.ADMIN_ACCESS in normalized
