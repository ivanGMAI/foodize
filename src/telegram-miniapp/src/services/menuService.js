import api from "./api";

export const menuService = {
  getMenu: (restaurantId) => api.get(`/menu/${restaurantId}`),
};
