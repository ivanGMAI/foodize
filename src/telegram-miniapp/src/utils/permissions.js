export const PERMISSIONS = {
  ADMIN_ACCESS: "admin.access",
};

export const hasPermission = (user, permission) =>
  Array.isArray(user?.permissions) && user.permissions.includes(permission);
