import uuid

from features.users.models import User
from shared.enums.roles import UserRole
from shared.permissions import (
    ADMIN_PERMISSIONS,
    CUSTOMER_PERMISSIONS,
    STAFF_PERMISSIONS,
    VENDOR_PERMISSIONS,
    serialize_permissions,
)


def make_user(
    *,
    user_id: uuid.UUID | None = None,
    name: str = "Test User",
    phone_number: str = "79001234567",
    hashed_password: str = "hashed_secret",
    user_role: str | None = None,
) -> User:

    user = User()
    user.id = user_id or uuid.uuid4()
    user.name = name
    user.phone_number = phone_number
    user.hashed_password = hashed_password

    perms = CUSTOMER_PERMISSIONS
    if user_role == UserRole.VENDOR.value:
        perms = VENDOR_PERMISSIONS
    elif user_role == UserRole.STAFF.value:
        perms = STAFF_PERMISSIONS
    elif user_role == UserRole.ADMIN.value:
        perms = ADMIN_PERMISSIONS

    user.permissions = serialize_permissions(perms)
    user.is_active = True
    return user
