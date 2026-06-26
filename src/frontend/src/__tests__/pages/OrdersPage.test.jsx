import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import OrdersPage from '../../pages/orders/OrdersPage';
import { useOrderStore } from '../../store/useOrderStore';

vi.mock('../../store/useOrderStore', () => ({
  useOrderStore: vi.fn((sel) => {
    const state = {
      orders: [
        { id: 'order-1', total_price: 500, status: 'PENDING', items: [1] },
        { id: 'order-2', total_price: 1000, status: 'READY', items: [2] },
      ],
      ordersTotal: 2,
      fetchMyOrders: vi.fn(),
      ordersLoading: false,
    };
    return sel ? sel(state) : state;
  }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('OrdersPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders orders list', () => {
    render(
      <BrowserRouter>
        <OrdersPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Мои заказы')).toBeDefined();
    expect(screen.getByText('500 ₽')).toBeDefined();
    expect(screen.getByText('1000 ₽')).toBeDefined();
  });

  it('navigates to order status page on click', () => {
    render(
      <BrowserRouter>
        <OrdersPage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByText('500 ₽'));
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('/orders/order-1')
    );
  });

  it('shows empty state if no active orders', () => {
    vi.mocked(useOrderStore).mockImplementation((sel) => {
      const state = {
        orders: [],
        ordersTotal: 0,
        fetchMyOrders: vi.fn(),
        ordersLoading: false,
      };
      return sel ? sel(state) : state;
    });

    render(
      <BrowserRouter>
        <OrdersPage />
      </BrowserRouter>
    );

    expect(screen.getByText('Активных заказов нет')).toBeDefined();
  });
});
