import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrderStatusPage from '../../pages/orders/OrderStatusPage';
import { useOrderStore } from '../../store/useOrderStore';

vi.mock('../../store/useOrderStore', () => ({
  useOrderStore: vi.fn(),
}));

vi.mock('../../services/orderService', () => ({
  orderService: {
    getOrderEvents: vi.fn().mockResolvedValue({ data: [] }),
    completeOrder: vi.fn().mockResolvedValue({}),
  },
}));

describe('OrderStatusPage', () => {
  const fetchOrderMock = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    const state = {
      fetchOrder: fetchOrderMock,
      currentOrder: {
        id: 'ord-1',
        status: 'PENDING',
        total_price: 500,
        items: [
          {
            id: 'i1',
            quantity: 1,
            menu_item_id: 'm1',
            menu_item_name: 'Бургер',
            menu_item_category: 'BURGER',
            price_at_purchase: 500,
          },
        ],
      },
    };

    vi.mocked(useOrderStore).mockImplementation((sel) => {
      return sel ? sel(state) : state;
    });
    useOrderStore.getState = vi.fn(() => state);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderWithRouter = () => {
    return render(
      <MemoryRouter initialEntries={['/orders/ord-1']}>
        <Routes>
          <Route path="/orders/:id" element={<OrderStatusPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  it('renders order details and initial status', () => {
    renderWithRouter();

    expect(screen.getAllByText('Принят').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/500 ₽/)).toHaveLength(2);
    expect(screen.getByText('Бургер')).toBeDefined();
  });

  it('fetches the order on mount', async () => {
    renderWithRouter();

    expect(fetchOrderMock).toHaveBeenCalledTimes(1);
  });

  it('stops polling when status is ready', async () => {
    // Return ready on the next poll
    fetchOrderMock.mockResolvedValue({ status: 'READY' });

    renderWithRouter();

    // 1st call on mount (pending)
    // 2nd call after 5s (ready)
    await act(async () => {
      vi.advanceTimersByTime(5000);
      // Wait for the async callback to finish
      await Promise.resolve();
      await Promise.resolve();
    });

    const callsAfterReady = fetchOrderMock.mock.calls.length;
    expect(callsAfterReady).toBeGreaterThanOrEqual(1);

    await act(async () => {
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
    });

    // Should not have increased further
    expect(fetchOrderMock.mock.calls.length).toBe(callsAfterReady);
  });
});
