import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import VendorDashboardPage from '../../pages/vendor/VendorDashboardPage';
import { useAuthStore } from '../../store/useAuthStore';
import { useRestaurantStore } from '../../store/useRestaurantStore';
import { vendorService } from '../../services/vendorService';

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: vi.fn((sel) => {
    const state = {
      isAuthenticated: true,
      user: { name: 'Ivan Ivanov', phone_number: '+7999' },
    };
    return sel ? sel(state) : state;
  }),
}));

vi.mock('../../store/useRestaurantStore', () => ({
  useRestaurantStore: vi.fn((sel) => {
    const state = {
      restaurants: [{ id: 'r1', name: 'My Resto', address: 'Addr 1' }],
      fetchMyRestaurants: vi.fn(),
      fetchMenu: vi.fn(),
      createRestaurant: vi.fn(),
      addMenuItem: vi.fn(),
      loading: false,
      menus: { r1: [] },
    };
    return sel ? sel(state) : state;
  }),
}));

vi.mock('../../services/vendorService', () => ({
  vendorService: {
    getStaffRequests: vi.fn().mockResolvedValue({ data: [] }),
    updateStaffStatus: vi.fn(),
    getStaffMembers: vi.fn().mockResolvedValue({ data: { data: [] } }),
    removeStaffMember: vi.fn().mockResolvedValue({}),
    getMyProfile: vi
      .fn()
      .mockResolvedValue({ data: { data: { approval_status: 'APPROVED' } } }),
  },
}));

describe('VendorDashboardPage', () => {
  const createRestaurantMock = vi.fn();
  const logoutMock = vi.fn();

  const waitForVendorEffects = async () => {
    await waitFor(() => {
      expect(vendorService.getMyProfile).toHaveBeenCalled();
      expect(vendorService.getStaffRequests).toHaveBeenCalled();
      expect(vendorService.getStaffMembers).toHaveBeenCalled();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockImplementation((sel) => {
      const state = {
        user: { name: 'Ivan Ivanov', phone_number: '+7999' },
        logout: logoutMock,
      };
      return sel ? sel(state) : state;
    });
    vi.mocked(useRestaurantStore).mockImplementation((sel) => {
      const state = {
        restaurants: [{ id: 'r1', name: 'My Resto', address: 'Addr 1' }],
        fetchMyRestaurants: vi.fn(),
        fetchMenu: vi.fn(),
        createRestaurant: createRestaurantMock,
        addMenuItem: vi.fn(),
        loading: false,
        menus: { r1: [] },
      };
      return sel ? sel(state) : state;
    });
  });

  it('renders vendor dashboard with restaurants', async () => {
    render(
      <BrowserRouter>
        <VendorDashboardPage />
      </BrowserRouter>
    );

    await waitForVendorEffects();

    expect(screen.getByText('Дашборд вендора')).toBeDefined();
    expect(screen.getByText('My Resto')).toBeDefined();
  });

  it('opens add restaurant form and submits', async () => {
    render(
      <BrowserRouter>
        <VendorDashboardPage />
      </BrowserRouter>
    );

    const addButton = await screen.findByRole('button', { name: /Добавить/ });
    await waitFor(() => expect(addButton).not.toBeDisabled());
    fireEvent.click(addButton);

    expect(screen.getByText('Новое заведение')).toBeDefined();

    fireEvent.change(screen.getByPlaceholderText('Название'), {
      target: { value: 'New Place' },
    });
    fireEvent.change(screen.getByPlaceholderText('Адрес'), {
      target: { value: 'New Addr' },
    });

    fireEvent.click(screen.getByText('Создать'));

    await waitFor(() => {
      expect(createRestaurantMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Place',
          address: 'New Addr',
          avg_prep_time_minutes: 15,
          max_active_orders: null,
        })
      );
    });
  });

  it('selects a restaurant and shows its menu section', async () => {
    render(
      <BrowserRouter>
        <VendorDashboardPage />
      </BrowserRouter>
    );

    await act(async () => {
      fireEvent.click(screen.getByText('My Resto'));
    });

    expect(screen.getByText(/Позиции меню/)).toBeDefined();
  });
});
