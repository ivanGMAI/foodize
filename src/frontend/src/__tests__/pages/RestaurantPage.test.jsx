import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RestaurantPage from '../../pages/restaurant/RestaurantPage';
import { useOrderStore } from '../../store/useOrderStore';

vi.mock('../../store/useRestaurantStore', () => ({
  useRestaurantStore: (sel) => {
    const state = {
      fetchMenu: vi.fn(),
      menus: {
        'mock-1': [
          {
            id: 'm1',
            name: 'Classic Shaurma',
            price: 300,
            category: 'SHAURMA',
            option_groups: [
              {
                id: 'g1',
                name: 'Добавки',
                selection_type: 'multiple',
                is_required: false,
                min_selected: 0,
                max_selected: 2,
                is_active: true,
                options: [
                  {
                    id: 'o1',
                    name: 'Добавить мясо',
                    price_delta: 80,
                    is_available: true,
                  },
                ],
              },
            ],
          },
          { id: 'm2', name: 'Veggie Burger', price: 400, category: 'BURGER' },
        ],
      },
      loading: false,
    };
    return sel ? sel(state) : state;
  },
}));

vi.mock('../../store/useOrderStore', () => ({
  useOrderStore: vi.fn((sel) => {
    const state = {
      cart: [],
      addToCart: vi.fn(),
      cartTotal: () => 0,
      cartCount: () => 0,
    };
    return sel ? sel(state) : state;
  }),
}));

vi.mock('../../services/restaurantService', () => ({
  restaurantService: {
    getById: vi.fn().mockResolvedValue({
      data: { data: { id: 'mock-1', name: 'Test Restaurant' } },
    }),
    getWorkingHours: vi.fn().mockResolvedValue({ data: { data: [] } }),
  },
}));

vi.mock('../../services/reviewService', () => ({
  reviewService: {
    getRating: vi
      .fn()
      .mockResolvedValue({ data: { data: { average_rating: 4.5 } } }),
    getReviews: vi
      .fn()
      .mockResolvedValue({ data: { data: [], pagination: { total: 0 } } }),
    createReview: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../services/staffService', () => ({
  staffService: {
    createRequest: vi.fn().mockResolvedValue({}),
  },
}));

describe('RestaurantPage', () => {
  const addToCartMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useOrderStore).mockImplementation((sel) => {
      const state = {
        cart: [],
        addToCart: addToCartMock,
        cartTotal: () => 0,
        cartCount: () => 0,
      };
      return sel ? sel(state) : state;
    });
  });

  const renderWithRouter = () =>
    render(
      <MemoryRouter initialEntries={['/restaurants/mock-1']}>
        <Routes>
          <Route path="/restaurants/:id" element={<RestaurantPage />} />
        </Routes>
      </MemoryRouter>
    );

  it('renders restaurant info and menu items', async () => {
    renderWithRouter();

    expect(await screen.findByText('Test Restaurant')).toBeDefined();
    expect(screen.getByText('Classic Shaurma')).toBeDefined();
    expect(screen.getByText('300 ₽')).toBeDefined();
  });

  it('opens product sheet and adds configured item to cart', async () => {
    renderWithRouter();

    expect(await screen.findByText('Test Restaurant')).toBeDefined();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Открыть Classic Shaurma/ })
      );
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Добавить мясо'));
    });
    await act(async () => {
      fireEvent.click(screen.getByText(/Добавить · 380 ₽/));
    });

    expect(addToCartMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'm1' }),
      'mock-1',
      [expect.objectContaining({ id: 'o1' })],
      1
    );
  });

  it('filters menu items by category', async () => {
    renderWithRouter();

    expect(await screen.findByText('Test Restaurant')).toBeDefined();
    expect(screen.getByText('Classic Shaurma')).toBeDefined();
    expect(screen.getByText('Veggie Burger')).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getAllByText('Бургеры')[0]);
    });

    expect(screen.queryByText('Classic Shaurma')).toBeNull();
    expect(screen.getByText('Veggie Burger')).toBeDefined();
  });
});
