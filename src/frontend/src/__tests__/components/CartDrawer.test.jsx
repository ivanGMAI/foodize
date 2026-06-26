import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CartDrawer from '../../components/ui/CartDrawer';
import { useOrderStore } from '../../store/useOrderStore';

vi.mock('../../services/orderService', () => ({
  orderService: {
    getEstimate: vi.fn().mockResolvedValue({
      data: {
        data: {
          ordering_available: true,
          active_orders_count: 1,
          avg_prep_time_minutes: 15,
          estimated_wait_min_minutes: 15,
          estimated_wait_max_minutes: 30,
        },
      },
    }),
  },
}));

vi.mock('../../services/promoService', () => ({
  promoService: {
    validate: vi.fn(),
  },
}));

vi.mock('../../store/useRestaurantStore', () => ({
  useRestaurantStore: (sel) => {
    const state = { menus: {} };
    return sel ? sel(state) : state;
  },
}));

// Mock useOrderStore
vi.mock('../../store/useOrderStore', () => {
  const store = {
    cart: [],
    cartRestaurantId: null,
    removeFromCart: vi.fn(),
    addToCart: vi.fn(),
    clearCart: vi.fn(),
    cartTotal: vi.fn(() => 0),
    cartCount: vi.fn(() => 0),
  };
  const useStore = (sel) => (sel ? sel(store) : store);
  useStore.getState = () => store;
  return { useOrderStore: useStore };
});

describe('CartDrawer', () => {
  const onCheckout = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useOrderStore.getState().cart = [];
    useOrderStore.getState().cartRestaurantId = null;
    useOrderStore.getState().cartTotal = vi.fn(() => 0);
    useOrderStore.getState().cartCount = vi.fn(() => 0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders null if cart is empty', () => {
    const { container } = render(
      <CartDrawer onClose={onClose} onCheckout={onCheckout} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders cart items and total', () => {
    const item = { id: '1', name: 'Pizza', price: 100 };
    useOrderStore.getState().cart = [{ menuItem: item, quantity: 2 }];
    useOrderStore.getState().cartTotal = () => 200;

    render(<CartDrawer onClose={onClose} onCheckout={onCheckout} />);

    expect(screen.getByText('Pizza')).toBeDefined();
    expect(screen.getAllByText(/200 ₽/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('2')).toBeDefined();
  });

  it('calls onCheckout when button clicked', () => {
    useOrderStore.getState().cart = [
      { menuItem: { id: '1', name: 'P' }, quantity: 1 },
    ];
    render(<CartDrawer onClose={onClose} onCheckout={onCheckout} />);

    fireEvent.click(screen.getByText('Оформить заказ'));
    expect(onCheckout).toHaveBeenCalled();
  });

  it('passes scheduled pickup time to checkout', async () => {
    vi.setSystemTime(new Date('2026-05-21T09:00:00.000Z'));
    useOrderStore.getState().cart = [
      { menuItem: { id: '1', name: 'P' }, quantity: 1 },
    ];
    useOrderStore.getState().cartRestaurantId = 'rest-1';
    render(<CartDrawer onClose={onClose} onCheckout={onCheckout} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Ко времени/ }));
    });
    await act(async () => {
      fireEvent.change(screen.getByDisplayValue('2026-05-21T12:15'), {
        target: { value: '2026-05-21T13:30' },
      });
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Оформить заказ'));
    });

    expect(onCheckout).toHaveBeenCalledWith(
      null,
      '',
      '2026-05-21T10:30:00.000Z'
    );
    vi.useRealTimers();
  });

  it('calls clearCart when cleared', () => {
    useOrderStore.getState().cart = [{ menuItem: { id: '1' }, quantity: 1 }];
    render(<CartDrawer onClose={onClose} onCheckout={onCheckout} />);

    fireEvent.click(screen.getByText('Очистить корзину'));
    expect(useOrderStore.getState().clearCart).toHaveBeenCalled();
  });
});
