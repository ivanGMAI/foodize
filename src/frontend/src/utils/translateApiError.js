const ERROR_MAP = {
  'Invalid phone number or password': 'Неверный телефон или пароль',
  'Invalid credentials': 'Неверный телефон или пароль',
  'Not authenticated': 'Необходима авторизация',
  'Token has expired': 'Сессия истекла, войдите заново',
  'Invalid token': 'Недействительный токен авторизации',
  'Token has been invalidated': 'Сессия завершена, войдите заново',
  'Account is deactivated': 'Аккаунт деактивирован',
  'Refresh token missing': 'Необходима авторизация',
  'Refresh token has expired': 'Сессия истекла, войдите заново',
  'Invalid refresh token': 'Недействительный токен авторизации',
  'Refresh token already used': 'Токен уже использован, войдите заново',
  'Access denied': 'Доступ запрещён',
  'Bad request': 'Некорректный запрос',
  'You have already reviewed this restaurant':
    'Вы уже оставили отзыв на этот ресторан',
  'You can publish up to 5 reviews for one restaurant':
    'Можно опубликовать до 5 отзывов на один ресторан',
  'Duplicate entry: this information already exists':
    'Вы уже оставили отзыв на этот ресторан',
  'You can only review restaurants where you have a completed order':
    'Отзыв можно оставить только при наличии завершённого заказа',
  'You already have a pending request for this restaurant.':
    'У вас уже есть активная заявка на этот ресторан',
  'Your previous request was rejected. Please try again after 24 hours.':
    'Ваша предыдущая заявка была отклонена. Повторная подача возможна через 24 часа',
  'You are already a staff member at this restaurant.':
    'Вы уже являетесь сотрудником этого ресторана',
  'You are not a hiring restaurant.':
    'Этот ресторан не принимает заявки на сотрудников',
  'Staff request not found': 'Заявка не найдена',
  'Restaurant is already in favorites': 'Ресторан уже добавлен в избранное',
  'Favorite not found': 'Запись в избранном не найдена',
  'Order not found': 'Заказ не найден',
  'You do not have permission to access this order':
    'У вас нет доступа к этому заказу',
  'One or more menu items were not found':
    'Один или несколько товаров не найдены',
  'One or more menu items do not belong to the specified restaurant':
    'Один или несколько товаров не принадлежат этому ресторану',
  'Order can only be cancelled when in PENDING or ACCEPTED status':
    'Отменить заказ можно только пока он ожидает или готовится',
  'Invalid order status transition': 'Недопустимое изменение статуса заказа',
  'One or more menu items are not available':
    'Один или несколько товаров недоступны для заказа',
  'Order can only be completed when in READY status':
    'Подтвердить получение можно только в статусе «Готов»',
  'Ready time is required to accept an order':
    'Укажите время готовности заказа',
  'Idempotency key was used with different payload':
    'Конфликт запроса, попробуйте ещё раз',
  'Idempotent request is still being processed':
    'Запрос уже обрабатывается, подождите',
  'Restaurant not found': 'Ресторан не найден',
  'Restaurant is currently closed': 'Ресторан сейчас закрыт',
  'Restaurant is temporarily not accepting orders':
    'Заведение временно поставило приём заказов на паузу',
  'Duplicate options selected': 'Одна и та же опция выбрана дважды',
  'Selected option not found':
    'Одна из выбранных опций больше недоступна. Обновите меню и попробуйте снова',
  'Selected option does not belong to menu item':
    'Одна из выбранных опций не относится к этому блюду',
  'Selected option is not available':
    'Одна из выбранных опций сейчас недоступна',
  'Not enough options selected': 'Выберите обязательные опции блюда',
  'Too many options selected': 'Выбрано слишком много опций для блюда',
  'Only one option can be selected':
    'В этой группе можно выбрать только одну опцию',
  'User already has a vendor profile': 'У вас уже есть профиль вендора',
  'User with this phone number already exists':
    'Пользователь с таким номером телефона уже существует',
  'Menu item not found': 'Товар не найден',
  'Promo code not found': 'Промокод не найден',
  'Promo code is not active or has expired': 'Промокод неактивен или истёк',
  'Promo code is not valid for this restaurant':
    'Промокод не действителен для этого ресторана',
  'Promo code usage limit has been reached':
    'Лимит использования промокода исчерпан',
  'Promo code already exists': 'Промокод с таким кодом уже существует',
  'Only VENDOR and STAFF can access orders':
    'Доступ только для вендоров и сотрудников',
  'Restaurant with this address already exists':
    'Ресторан с таким адресом уже существует',
};

export function translateApiError(err, fallback) {
  const detail = err?.response?.data?.detail;
  if (detail && typeof detail === 'string') {
    const exact = ERROR_MAP[detail];
    if (exact) return exact;
    const prefix = Object.keys(ERROR_MAP).find((key) => detail.startsWith(key));
    return prefix ? ERROR_MAP[prefix] : (fallback ?? detail);
  }
  return fallback;
}
