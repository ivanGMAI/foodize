import api from './api';

export const restaurantService = {
  getAll: (params) => api.get('/restaurants/public', { params }),
  getById: (id) => api.get(`/restaurants/public/${id}`),
  getMy: () => api.get('/restaurants/'),
  create: (data) => api.post('/restaurants/', data),
  update: (id, data) => api.patch(`/restaurants/${id}`, data),
  getWorkingHours: (id) => api.get(`/restaurants/${id}/working-hours`),
  setWorkingHours: (id, hours) =>
    api.put(`/restaurants/${id}/working-hours`, { hours }),
};
