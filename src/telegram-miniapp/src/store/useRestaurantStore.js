import { create } from "zustand";
import { restaurantService } from "../services/restaurantService";
import { menuService } from "../services/menuService";

export const useRestaurantStore = create((set, get) => ({
  publicRestaurants: [],
  publicRestaurantsTotal: 0,
  menus: {},
  loading: false,

  fetchPublicRestaurants: async (params = {}) => {
    set({ loading: true });
    try {
      const res = await restaurantService.getAll(params);
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      const total = res.data?.pagination?.total || list.length;
      set({
        publicRestaurants: list,
        publicRestaurantsTotal: total,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  fetchMenu: async (restaurantId, { force = false } = {}) => {
    if (!force && get().menus[restaurantId]) return;
    set({ loading: true });
    try {
      const res = await menuService.getMenu(restaurantId);
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      set((s) => ({
        menus: { ...s.menus, [restaurantId]: list },
        loading: false,
      }));
    } catch {
      set({ loading: false });
    }
  },
}));
