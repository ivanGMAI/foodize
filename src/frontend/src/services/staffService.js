import api from './api';

export const staffService = {
  createRequest: (restaurantId, data) =>
    api.post(`/staff/requests/${restaurantId}`, data),

  getMyProfile: () => api.get('/staff/me'),
  getMyApplication: () => api.get('/staff/my-application'),

  getRestaurantOrders: (restaurantId, params = {}) =>
    api.get(`/orders/restaurant/${restaurantId}`, { params }),

  updateOrderStatus: (orderId, status, data = {}) =>
    api.patch(`/orders/${orderId}/status`, { status, ...data }),

  getMenu: (restaurantId) => api.get(`/menu/${restaurantId}`),

  toggleMenuItemAvailability: (restaurantId, itemId, isAvailable) =>
    api.patch(`/staff/menu/${restaurantId}/items/${itemId}/availability`, {
      is_available: isAvailable,
    }),

  cancelOrder: (orderId, reason) =>
    api.post(`/orders/${orderId}/cancel`, { reason }),
};
