import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import HomePage from '../../pages/home/HomePage';

const fetchPublicRestaurantsMock = vi.fn();

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: (sel) => {
    const state = { isAuthenticated: true };
    return sel ? sel(state) : state;
  },
}));

vi.mock('../../store/useRestaurantStore', () => ({
  useRestaurantStore: (sel) => {
    const state = {
      publicRestaurants: [
        { id: 'mock-1', name: 'Шаурма Хаус' },
        { id: 'mock-2', name: 'Burger Point' },
        { id: 'mock-3', name: 'Pizza Nova' },
        { id: 'mock-4', name: 'Sushi House' },
      ],
      publicRestaurantsTotal: 4,
      fetchPublicRestaurants: fetchPublicRestaurantsMock,
      loading: false,
    };
    return sel ? sel(state) : state;
  },
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

window.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders search bar and open filter inside filter menu', () => {
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

    expect(
      screen.getByPlaceholderText('Поиск ресторана или адреса...')
    ).toBeDefined();

    fireEvent.click(screen.getByLabelText('Открыть фильтры'));
    expect(screen.getByText('Открыто')).toBeDefined();
  });

  it('renders all restaurant cards', () => {
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

    expect(screen.getByText('Шаурма Хаус')).toBeDefined();
    expect(screen.getByText('Burger Point')).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
  });

  it('navigates to restaurant page on card click', () => {
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByText('Шаурма Хаус'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/restaurants/mock-1'),
      expect.anything()
    );
  });
});
