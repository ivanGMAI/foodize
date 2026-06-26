import api from './api';

export const adminService = {
  getUsers: (params) => api.get('/admin/users', { params }),
  getUser: (id) => api.get(`/admin/users/${id}`),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  activateUser: (id) => api.post(`/admin/users/${id}/activate`),
  grantAdmin: (id) => api.post(`/admin/users/${id}/grant-admin`),
  setPermissions: (id, permissions) =>
    api.post(`/admin/users/${id}/permissions`, { permissions }),
  resetMyPermissions: () => api.post('/admin/me/reset-permissions'),
  getOrders: (params) => api.get('/admin/orders', { params }),
  getRestaurants: (params) => api.get('/admin/restaurants', { params }),
  getRestaurant: (id) => api.get(`/admin/restaurants/${id}`),
  deleteRestaurant: (id) => api.delete(`/admin/restaurants/${id}`),
  approveRestaurant: (id) => api.post(`/admin/restaurants/${id}/approve`),
  rejectRestaurant: (id, reason) =>
    api.post(`/admin/restaurants/${id}/reject`, { reason }),
  getVendors: (params) => api.get('/admin/vendors', { params }),
  getVendor: (id) => api.get(`/admin/vendors/${id}`),
  deleteVendor: (id) => api.delete(`/admin/vendors/${id}`),
  approveVendor: (id) => api.post(`/admin/vendors/${id}/approve`),
  rejectVendor: (id, reason) =>
    api.post(`/admin/vendors/${id}/reject`, { reason }),
  getReviews: (params) => api.get('/admin/reviews', { params }),
  deleteReview: (id) => api.delete(`/admin/reviews/${id}`),
  getPlatformStats: () => api.get('/admin/stats'),
  getFinance: (params) => api.get('/admin/finance', { params }),
  getAdvancedAnalytics: (params) => api.get('/admin/analytics', { params }),

  getAuditLogs: (params) => api.get('/admin/audit-logs', { params }),

  batchDeactivateUsers: (ids) =>
    api.post('/admin/users/batch-deactivate', { ids }),
  batchActivateUsers: (ids) => api.post('/admin/users/batch-activate', { ids }),
  batchDeleteReviews: (ids) =>
    api.delete('/admin/reviews/batch', { data: { ids } }),

  batchApproveVendors: (ids) =>
    api.post('/admin/vendors/batch-approve', { ids }),
  batchRejectVendors: (ids, reason) =>
    api.post('/admin/vendors/batch-reject', { ids, reason }),
  batchApproveRestaurants: (ids) =>
    api.post('/admin/restaurants/batch-approve', { ids }),
  batchRejectRestaurants: (ids, reason) =>
    api.post('/admin/restaurants/batch-reject', { ids, reason }),

  exportUsersCSV: () =>
    api.get('/admin/export/users.csv', { responseType: 'blob' }),
  exportOrdersCSV: (params) =>
    api.get('/admin/export/orders.csv', { params, responseType: 'blob' }),
  exportRestaurantsCSV: () =>
    api.get('/admin/export/restaurants.csv', { responseType: 'blob' }),
  exportVendorsCSV: () =>
    api.get('/admin/export/vendors.csv', { responseType: 'blob' }),
  exportReviewsCSV: (params) =>
    api.get('/admin/export/reviews.csv', { params, responseType: 'blob' }),
  exportFinancePDF: (params) =>
    api.get('/admin/export/finance.pdf', { params, responseType: 'blob' }),
  exportAnalyticsPDF: (params) =>
    api.get('/admin/export/analytics.pdf', { params, responseType: 'blob' }),
  exportOverviewPDF: (params) =>
    api.get('/admin/export/overview.pdf', { params, responseType: 'blob' }),
};
