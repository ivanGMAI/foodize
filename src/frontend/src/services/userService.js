import api from './api';

export const userService = {
  updateMe: (data) => api.patch('/users/me', data),
  changePassword: (data) => api.post('/users/me/change-password', data),
};
