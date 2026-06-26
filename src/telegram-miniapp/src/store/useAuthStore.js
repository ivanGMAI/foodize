import { create } from "zustand";
import { authService } from "../services/authService";
import { TELEGRAM_INIT_DATA_STORAGE_KEY } from "../telegram/sdk";

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,

  setAuthenticated: (user) => set({ user, isAuthenticated: true }),

  login: async (credentials) => {
    const resp = await authService.login(credentials);
    const { access_token, refresh_token } = resp.data.data;
    sessionStorage.setItem("access_token", access_token);
    sessionStorage.setItem("refresh_token", refresh_token);
    const me = await authService.getMe();
    localStorage.removeItem("foodize_tg_logged_out");
    set({ user: me.data.data, isAuthenticated: true });
  },

  fetchMe: async () => {
    try {
      const resp = await authService.getMe();
      set({ user: resp.data.data, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    }
  },

  logout: async () => {
    const currentUser = useAuthStore.getState().user;
    if (currentUser?.phone_number) {
      localStorage.setItem("foodize_tg_last_phone", currentUser.phone_number);
    }

    try {
      await authService.logout();
    } catch {}
    const telegramInitData = sessionStorage.getItem(
      TELEGRAM_INIT_DATA_STORAGE_KEY,
    );
    localStorage.setItem("foodize_tg_logged_out", "1");
    sessionStorage.clear();
    if (telegramInitData) {
      sessionStorage.setItem(TELEGRAM_INIT_DATA_STORAGE_KEY, telegramInitData);
    }
    set({ user: null, isAuthenticated: false });
  },
}));
