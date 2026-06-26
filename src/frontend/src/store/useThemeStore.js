import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'light',

      toggleTheme: () => {
        const next = get().theme === 'light' ? 'dark' : 'light';
        set({ theme: next });
        document.documentElement.setAttribute('data-theme', next);
      },

      initTheme: () => {
        const saved = get().theme;
        document.documentElement.setAttribute('data-theme', saved);
      },
    }),
    { name: 'foodize-theme' }
  )
);
