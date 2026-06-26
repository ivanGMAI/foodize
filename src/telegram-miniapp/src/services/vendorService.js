import api from "./api";

export const vendorService = {
  createProfile: (data) => api.post("/vendors/", data),
  getMyProfile: () => api.get("/vendors/"),
};
