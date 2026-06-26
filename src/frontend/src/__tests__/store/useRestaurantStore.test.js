import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRestaurantStore } from '../../store/useRestaurantStore';
import { restaurantService } from '../../services/restaurantService';
import { menuService } from '../../services/menuService';

vi.mock('../../services/restaurantService', () => ({
  restaurantService: {
    getMy: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../../services/menuService', () => ({
  menuService: {
    getMenu: vi.fn(),
    addItem: vi.fn(),
  },
}));

describe('useRestaurantStore', () => {
  beforeEach(() => {
    useRestaurantStore.setState({
      restaurants: [],
      menus: {},
      currentRestaurant: null,
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('fetchMyRestaurants updates state on success', async () => {
    const mockRestaurants = [{ id: '1', name: 'R1' }];
    restaurantService.getMy.mockResolvedValueOnce({
      data: { data: mockRestaurants },
    });

    await useRestaurantStore.getState().fetchMyRestaurants();

    const state = useRestaurantStore.getState();
    expect(state.restaurants).toEqual(mockRestaurants);
    expect(state.loading).toBe(false);
  });

  it('fetchMenu caches the menu', async () => {
    const restId = '1';
    const mockMenu = [{ id: 'm1', name: 'Dish' }];
    menuService.getMenu.mockResolvedValueOnce({ data: { data: mockMenu } });

    await useRestaurantStore.getState().fetchMenu(restId);

    // Second call should not trigger service
    await useRestaurantStore.getState().fetchMenu(restId);

    expect(menuService.getMenu).toHaveBeenCalledTimes(1);
    expect(useRestaurantStore.getState().menus[restId]).toEqual(mockMenu);
  });

  it('createRestaurant adds to the list', async () => {
    const newRest = { id: '2', name: 'R2' };
    restaurantService.create.mockResolvedValueOnce({ data: { data: newRest } });

    await useRestaurantStore.getState().createRestaurant({ name: 'R2' });

    expect(useRestaurantStore.getState().restaurants).toContainEqual(newRest);
  });
});
