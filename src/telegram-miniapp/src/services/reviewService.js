import api from "./api";

export const reviewService = {
  createReview: (restaurantId, data) =>
    api.post(`/restaurants/${restaurantId}/reviews`, data),
  updateMyReview: (restaurantId, data) =>
    api.put(`/restaurants/${restaurantId}/reviews/my`, data),
  deleteReview: (restaurantId, reviewId) =>
    api.delete(`/restaurants/${restaurantId}/reviews/${reviewId}`),
  getReviews: (restaurantId) => api.get(`/restaurants/${restaurantId}/reviews`),
  getRating: (restaurantId) => api.get(`/restaurants/${restaurantId}/rating`),
};
