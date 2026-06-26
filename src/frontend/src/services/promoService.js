import api from './api';

export const promoService = {
  validate: (code, restaurantId) =>
    api.post('/promos/validate', { code, restaurant_id: restaurantId }),

  create: (data) => api.post('/promos', data),
  list: () => api.get('/promos'),
  deactivate: (code) => api.delete(`/promos/${code}`),
};
