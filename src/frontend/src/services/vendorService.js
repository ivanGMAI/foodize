import api from './api';

export const vendorService = {
  createProfile: (data) => api.post('/vendors/', data),
  getMyProfile: () => api.get('/vendors/'),
  getFinance: (params) => api.get('/vendors/finance', { params }),
  getAdvancedAnalytics: (params) => api.get('/vendors/analytics', { params }),
  getStaffRequests: (params) => api.get('/staff/my-requests', { params }),
  updateStaffStatus: (requestId, status) =>
    api.patch(`/staff/requests/${requestId}/status`, { status }),
  getStaffMembers: (params) => api.get('/staff/my-members', { params }),
  removeStaffMember: (profileId) => api.delete(`/staff/members/${profileId}`),

  exportOrdersCSV: (params) =>
    api.get('/vendors/export/orders.csv', { params, responseType: 'blob' }),
  exportMenuCSV: (params) =>
    api.get('/vendors/export/menu.csv', { params, responseType: 'blob' }),
  exportPromosCSV: (params) =>
    api.get('/vendors/export/promos.csv', { params, responseType: 'blob' }),
  exportFinancePDF: (params) =>
    api.get('/vendors/export/finance.pdf', { params, responseType: 'blob' }),
  exportAnalyticsPDF: (params) =>
    api.get('/vendors/export/analytics.pdf', { params, responseType: 'blob' }),
};
