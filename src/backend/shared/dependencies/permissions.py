from collections.abc import Sequence

from fastapi import Depends

from features.auth.service import get_current_user
from features.users.models import User
from shared.enums.permissions import Permission
from shared.exceptions.rules import RuleException
from shared.permissions import has_permission


class PermissionChecker:
    def __init__(self, required_permissions: Sequence[Permission]):
        self.required_permissions = tuple(required_permissions)

    def __call__(self, user: User = Depends(get_current_user)) -> User:
        missing_permissions = [
            permission
            for permission in self.required_permissions
            if not has_permission(user.permissions, permission)
        ]
        if missing_permissions:
            raise RuleException(detail="Insufficient permissions to perform this action")
        return user


def require_permission(*permissions: Permission) -> PermissionChecker:
    return PermissionChecker(required_permissions=permissions)
