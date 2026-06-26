import { create } from 'zustand';
import { favoriteService } from '../services/favoriteService';

export const useFavoriteStore = create((set, get) => ({
  favoriteIds: new Set(),
  loaded: false,

  loadFavorites: async () => {
    try {
      const res = await favoriteService.getAll({ size: 100 });
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      set({
        favoriteIds: new Set(list.map((f) => f.restaurant.id)),
        loaded: true,
      });
    } catch {
      set({ loaded: true });
    }
  },

  toggle: async (restaurantId) => {
    const { favoriteIds } = get();
    const isFav = favoriteIds.has(restaurantId);
    const prevSet = new Set(favoriteIds);
    const newSet = new Set(favoriteIds);
    if (isFav) {
      newSet.delete(restaurantId);
      set({ favoriteIds: newSet });
      try {
        await favoriteService.remove(restaurantId);
      } catch {
        set({ favoriteIds: prevSet });
      }
    } else {
      newSet.add(restaurantId);
      set({ favoriteIds: newSet });
      try {
        await favoriteService.add(restaurantId);
      } catch {
        set({ favoriteIds: prevSet });
      }
    }
  },
}));
