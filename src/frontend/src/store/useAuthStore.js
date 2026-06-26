import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authService } from '../services/authService';

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,

      login: async (credentials) => {
        const response = await authService.login(credentials);
        const { access_token } = response.data.data;
        localStorage.setItem('access_token', access_token);
        const me = await authService.getMe();
        set({ user: me.data.data, isAuthenticated: true });
      },

      loginWithTelegramCode: async (data) => {
        const response = await authService.verifyTelegramLoginCode(data);
        const { access_token, requires_password } = response.data.data;
        localStorage.setItem('access_token', access_token);
        const me = await authService.getMe();
        set({ user: me.data.data, isAuthenticated: true });
        return { requiresPassword: requires_password };
      },

      setTelegramSitePassword: async (password) => {
        await authService.setTelegramSitePassword({ password });
        const me = await authService.getMe();
        set({ user: me.data.data, isAuthenticated: true });
      },

      register: async (userData) => {
        await authService.register(userData);
      },

      logout: async () => {
        try {
          await authService.logout();
        } finally {
          localStorage.removeItem('access_token');
          set({ user: null, isAuthenticated: false });
        }
      },

      fetchMe: async () => {
        try {
          const me = await authService.getMe();
          set({ user: me.data.data, isAuthenticated: true });
        } catch {
          set({ user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
