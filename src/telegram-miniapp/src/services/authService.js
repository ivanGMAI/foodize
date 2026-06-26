import api from "./api";

export const authService = {
  login: (data) => api.post("/login", data),
  logout: () =>
    api.post("/logout", null, {
      headers: {
        "X-Refresh-Token": sessionStorage.getItem("refresh_token") || "",
      },
    }),
  telegramCheck: (initData) =>
    api.post("/telegram/check", { init_data: initData }),
  telegramRegister: (initData, phoneNumber, name) =>
    api.post("/telegram/register", {
      init_data: initData,
      phone_number: phoneNumber,
      name,
    }),
  telegramAuth: (initData) =>
    api.post("/telegram/auth", { init_data: initData }),
  telegramLogout: () => api.post("/telegram/logout"),
  getMe: () => api.get("/users/me"),
};
