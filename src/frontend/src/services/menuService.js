import api from './api';

export const menuService = {
  getMenu: (restaurantId) => api.get(`/menu/${restaurantId}`),
  addItem: (restaurantId, data) =>
    api.post(`/menu/${restaurantId}/items`, data),
  updateItem: (restaurantId, itemId, data) =>
    api.patch(`/menu/${restaurantId}/items/${itemId}`, data),
  deleteItem: (restaurantId, itemId) =>
    api.delete(`/menu/${restaurantId}/items/${itemId}`),
  createOptionGroup: (restaurantId, itemId, data) =>
    api.post(`/menu/${restaurantId}/items/${itemId}/option-groups`, data),
  updateOptionGroup: (restaurantId, itemId, groupId, data) =>
    api.patch(
      `/menu/${restaurantId}/items/${itemId}/option-groups/${groupId}`,
      data
    ),
  deleteOptionGroup: (restaurantId, itemId, groupId) =>
    api.delete(
      `/menu/${restaurantId}/items/${itemId}/option-groups/${groupId}`
    ),
  createOption: (restaurantId, itemId, groupId, data) =>
    api.post(
      `/menu/${restaurantId}/items/${itemId}/option-groups/${groupId}/options`,
      data
    ),
  updateOption: (restaurantId, itemId, groupId, optionId, data) =>
    api.patch(
      `/menu/${restaurantId}/items/${itemId}/option-groups/${groupId}/options/${optionId}`,
      data
    ),
  deleteOption: (restaurantId, itemId, groupId, optionId) =>
    api.delete(
      `/menu/${restaurantId}/items/${itemId}/option-groups/${groupId}/options/${optionId}`
    ),
  toggleAvailability: (restaurantId, itemId, isAvailable) =>
    api.patch(`/menu/${restaurantId}/items/${itemId}/availability`, {
      is_available: isAvailable,
    }),
};
