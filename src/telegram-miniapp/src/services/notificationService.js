import api from "./api";

export const notificationService = {
  getNotifications: (params) => api.get("/notifications", { params }),
  markAsRead: (id) => api.post(`/notifications/${id}/read`),
  markAllAsRead: () => api.post("/notifications/read-all"),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  deleteAll: () => api.delete("/notifications"),
};
