import api from "./api";

export const promoService = {
  validate: (code, restaurantId) =>
    api.post("/promos/validate", { code, restaurant_id: restaurantId }),
};
