export const ORDER_STATUS_RU = {
  PENDING: 'Новый',
  ACCEPTED: 'Принят',
  READY: 'Готов к выдаче',
  COMPLETED: 'Выдан',
  CANCELLED: 'Отменён',
};

export const APPROVAL_STATUS_RU = {
  PENDING: 'На модерации',
  APPROVED: 'Одобрен',
  REJECTED: 'Отклонён',
};

export const CATEGORY_RU = {
  SHAURMA: 'Шаурма',
  BURGER: 'Бургеры',
  DRINK: 'Напитки',
  PIZZA: 'Пицца',
  SUSHI: 'Суши',
  DESSERT: 'Десерты',
  SNACK: 'Снеки',
  SALAD: 'Салаты',
  OTHER: 'Разное',
};

export const DISCOUNT_TYPE_RU = {
  PERCENT: 'Процент',
  FIXED: 'Сумма',
};

export const STAFF_STATUS_RU = {
  PENDING: 'Новая заявка',
  APPROVED: 'Принят',
  REJECTED: 'Отклонён',
  REVOKED: 'Отозван',
};

export const STAFF_ROLE_RU = {
  COOK: 'Повар',
};

export const translate = (dict, key, fallback = '') => {
  if (!key) return fallback;
  return dict[key] || key;
};
