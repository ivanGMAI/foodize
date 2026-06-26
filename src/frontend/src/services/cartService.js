import api from './api';

export const cartService = {
  getCart: () => api.get('/cart'),
  updateCart: (data) => api.post('/cart', data),
  clearCart: () => api.delete('/cart'),
};
