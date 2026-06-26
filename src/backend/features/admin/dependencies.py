from fastapi import Depends

from features.admin.exceptions import AdminAccessDeniedException
from features.auth.service import get_current_user
from features.users.models import User
from shared.enums.permissions import Permission
from shared.permissions import has_permission


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if not has_permission(user.permissions, Permission.ADMIN_ACCESS):
        raise AdminAccessDeniedException()
    return user
