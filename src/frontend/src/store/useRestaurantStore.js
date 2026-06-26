import { create } from 'zustand';
import { restaurantService } from '../services/restaurantService';
import { menuService } from '../services/menuService';

export const useRestaurantStore = create((set, get) => ({
  publicRestaurants: [],
  restaurants: [],
  menus: {}, // { [restaurantId]: MenuItem[] }
  currentRestaurant: null,
  loading: false,
  error: null,

  publicRestaurantsTotal: 0,

  fetchPublicRestaurants: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const res = await restaurantService.getAll(params);
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      const total = res.data?.pagination?.total || list.length;
      set({
        publicRestaurants: list,
        publicRestaurantsTotal: total,
        loading: false,
      });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  fetchMyRestaurants: async () => {
    set({ loading: true, error: null });
    try {
      const res = await restaurantService.getMy();
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      set({ restaurants: list, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
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
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  setCurrentRestaurant: (restaurant) => set({ currentRestaurant: restaurant }),

  createRestaurant: async (data) => {
    const res = await restaurantService.create(data);
    set((s) => ({ restaurants: [...s.restaurants, res.data.data] }));
    return res.data.data;
  },

  addMenuItem: async (restaurantId, data) => {
    const res = await menuService.addItem(restaurantId, data);
    set((s) => {
      const currentMenu = Array.isArray(s.menus[restaurantId])
        ? s.menus[restaurantId]
        : [];
      return {
        menus: {
          ...s.menus,
          [restaurantId]: [...currentMenu, res.data.data],
        },
      };
    });
    return res.data.data;
  },
}));
