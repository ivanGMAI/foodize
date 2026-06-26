export const PERMISSIONS = {
  ADMIN_ACCESS: 'admin.access',
  VENDORS_READ_OWN: 'vendors.read_own',
  VENDORS_ANALYTICS_READ: 'vendors.analytics_read',
  STAFF_PROFILE_READ: 'staff.profile_read',
  MENU_MANAGE: 'menu.manage',
  ORDERS_READ_RESTAURANT: 'orders.read_restaurant',
  ORDERS_MANAGE_STATUS: 'orders.manage_status',
};

export const PERMISSION_RU = {
  'admin.access': 'Админ-доступ',
  'users.read': 'Пользователи: просмотр',
  'users.manage': 'Пользователи: управление',
  'users.assign_permissions': 'Пользователи: права',
  'restaurants.read': 'Рестораны: просмотр',
  'restaurants.create': 'Рестораны: создание',
  'restaurants.update': 'Рестораны: изменение',
  'restaurants.moderate': 'Рестораны: модерация',
  'menu.read': 'Меню: просмотр',
  'menu.manage': 'Меню: управление',
  'cart.manage': 'Корзина',
  'favorites.manage': 'Избранное',
  'orders.create': 'Заказы: создание',
  'orders.read_own': 'Заказы: свои',
  'orders.read_restaurant': 'Заказы: ресторан',
  'orders.manage_status': 'Заказы: статусы',
  'orders.moderate': 'Заказы: модерация',
  'reviews.create': 'Отзывы: создание',
  'reviews.read': 'Отзывы: просмотр',
  'reviews.moderate': 'Отзывы: модерация',
  'promos.validate': 'Промокоды: проверка',
  'promos.manage': 'Промокоды: управление',
  'vendors.create': 'Вендор: создание',
  'vendors.read_own': 'Вендор: профиль',
  'vendors.analytics_read': 'Вендор: аналитика',
  'vendors.moderate': 'Вендор: модерация',
  'staff.requests_create': 'Персонал: заявки',
  'staff.requests_manage': 'Персонал: управление заявками',
  'staff.members_manage': 'Персонал: сотрудники',
  'staff.profile_read': 'Персонал: профиль',
  'telegram.auth': 'Telegram',
};

export const CUSTOMER_PERMISSIONS = [
  'cart.manage',
  'favorites.manage',
  'menu.read',
  'orders.create',
  'orders.read_own',
  'promos.validate',
  'restaurants.read',
  'reviews.create',
  'reviews.read',
  'staff.requests_create',
  'telegram.auth',
];

export const VENDOR_PERMISSIONS = [
  ...CUSTOMER_PERMISSIONS,
  'menu.manage',
  'orders.manage_status',
  'orders.read_restaurant',
  'promos.manage',
  'restaurants.create',
  'restaurants.update',
  'staff.members_manage',
  'staff.profile_read',
  'staff.requests_manage',
  'vendors.analytics_read',
  'vendors.create',
  'vendors.read_own',
];

export const STAFF_PERMISSIONS = [
  ...CUSTOMER_PERMISSIONS,
  'orders.manage_status',
  'orders.read_restaurant',
  'staff.profile_read',
];

export const ADMIN_PERMISSIONS = Object.keys(PERMISSION_RU);

export const PERMISSION_PRESETS = {
  CUSTOMER: CUSTOMER_PERMISSIONS,
  VENDOR: VENDOR_PERMISSIONS,
  STAFF: STAFF_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
};

export const PERMISSION_PRESET_RU = {
  CUSTOMER: 'Клиент',
  VENDOR: 'Вендор',
  STAFF: 'Персонал',
  ADMIN: 'Администратор',
};

export const normalizePermissions = (permissions = []) =>
  Array.isArray(permissions) ? permissions : [];

export const hasPermission = (user, permission) => {
  const permissions = normalizePermissions(user?.permissions);
  return (
    permissions.includes(permission) ||
    permissions.includes(PERMISSIONS.ADMIN_ACCESS)
  );
};

export const inferPermissionPreset = (permissions = []) => {
  const set = new Set(normalizePermissions(permissions));
  if (set.has(PERMISSIONS.ADMIN_ACCESS)) return 'ADMIN';
  if (set.has(PERMISSIONS.VENDORS_READ_OWN)) return 'VENDOR';
  if (set.has(PERMISSIONS.STAFF_PROFILE_READ)) return 'STAFF';
  return 'CUSTOMER';
};

export const permissionPresetLabel = (permissions = []) =>
  PERMISSION_PRESET_RU[inferPermissionPreset(permissions)];

export const formatPermissions = (permissions = []) =>
  normalizePermissions(permissions)
    .map((permission) => PERMISSION_RU[permission] || permission)
    .join(', ');
