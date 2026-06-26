import pytest
from factories import make_user

from shared.dependencies.permissions import PermissionChecker
from shared.enums.permissions import Permission
from shared.enums.roles import UserRole
from shared.exceptions.rules import RuleException
from shared.permissions import (
    ADMIN_PERMISSIONS,
    CUSTOMER_PERMISSIONS,
    STAFF_PERMISSIONS,
    VENDOR_PERMISSIONS,
    has_permission,
)


class TestRolePermissions:
    def test_admin_has_every_permission(self):
        assert ADMIN_PERMISSIONS == frozenset(Permission)

    def test_admin_access_grants_every_permission(self):
        assert has_permission([Permission.ADMIN_ACCESS.value], Permission.MENU_MANAGE)

    def test_vendor_can_manage_menu_but_customer_cannot(self):
        assert has_permission(VENDOR_PERMISSIONS, Permission.MENU_MANAGE)
        assert not has_permission(CUSTOMER_PERMISSIONS, Permission.MENU_MANAGE)

    def test_staff_can_manage_order_status_but_cannot_manage_menu(self):
        assert has_permission(STAFF_PERMISSIONS, Permission.ORDERS_MANAGE_STATUS)
        assert not has_permission(STAFF_PERMISSIONS, Permission.MENU_MANAGE)


class TestPermissionChecker:
    def test_all_required_permissions_returns_user(self):
        checker = PermissionChecker(
            required_permissions=[
                Permission.RESTAURANTS_READ,
                Permission.ORDERS_CREATE,
            ]
        )
        user = make_user(user_role=UserRole.CUSTOMER)

        assert checker(user=user) is user

    def test_missing_permission_raises_rule_exception(self):
        checker = PermissionChecker(required_permissions=[Permission.MENU_MANAGE])
        user = make_user(user_role=UserRole.CUSTOMER)

        with pytest.raises(RuleException):
            checker(user=user)

    def test_rule_exception_has_403_status(self):
        checker = PermissionChecker(required_permissions=[Permission.ADMIN_ACCESS])
        user = make_user(user_role=UserRole.CUSTOMER)

        with pytest.raises(RuleException) as exc_info:
            checker(user=user)

        assert exc_info.value.status_code == 403
