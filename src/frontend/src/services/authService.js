import api from './api';

export const authService = {
  register: (data) => api.post('/register', data),
  login: (data) => api.post('/login', data),
  requestTelegramLoginCode: (data) =>
    api.post('/telegram/site-login/request-code', data),
  verifyTelegramLoginCode: (data) =>
    api.post('/telegram/site-login/verify', data),
  setTelegramSitePassword: (data) =>
    api.post('/telegram/site-login/password', data),
  getMe: () => api.get('/users/me'),
  logout: () => api.post('/logout'),
};
