import api from "./api";

export const restaurantService = {
  getAll: (params) => api.get("/restaurants/public", { params }),
  getById: (id) => api.get(`/restaurants/public/${id}`),
  getWorkingHours: (id) => api.get(`/restaurants/${id}/working-hours`),
};
