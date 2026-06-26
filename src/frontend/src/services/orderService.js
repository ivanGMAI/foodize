import api from './api';

export const orderService = {
  create: (data, config = {}) => api.post('/orders/', data, config),
  getEstimate: (restaurantId) => api.get(`/orders/estimate/${restaurantId}`),
  getMyOrders: (config) => api.get('/orders/me', config),
  getById: (id) => api.get(`/orders/${id}`),
  getByRestaurant: (restaurantId, params) =>
    api.get(`/orders/restaurant/${restaurantId}`, { params }),
  updateStatus: (id, status, data = {}) =>
    api.patch(`/orders/${id}/status`, { status, ...data }),
  completeOrder: (id) => api.post(`/orders/${id}/complete`),
  cancelOrder: (id, reason) => api.post(`/orders/${id}/cancel`, { reason }),
  getOrderEvents: (id) => api.get(`/orders/${id}/events`),
};
