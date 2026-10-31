from rest_framework.permissions import BasePermission


class IsAdminRole(BasePermission):
    """Allows access only to admins (role='admin' or a Django superuser)."""

    def has_permission(self, request, view):
        user = request.user
        # Three checks, in order:
        # 1. user exists
        # 2. user is logged in (anonymous users have is_authenticated = False)
        # 3. user has the admin role (the helper property we wrote on the User model)
        return bool(user and user.is_authenticated and user.is_admin_role)


class IsStaffRole(BasePermission):
    """Allows access to admins AND agents (anyone who works on tickets)."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_admin_role or user.is_agent_role)
        )