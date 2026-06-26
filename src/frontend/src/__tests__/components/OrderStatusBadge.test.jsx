import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import OrderStatusBadge from '../../components/ui/OrderStatusBadge';

describe('OrderStatusBadge', () => {
  it('renders pending status with ripple rings', () => {
    const { container } = render(<OrderStatusBadge status="PENDING" />);
    expect(screen.getByText('Новый')).toBeDefined();
    expect(screen.getByText('Ожидаем подтверждения ресторана')).toBeDefined();
    expect(container.querySelectorAll('.ripple-ring')).toHaveLength(3);
  });

  it('renders accepted status as confirmed by restaurant', () => {
    render(<OrderStatusBadge status="ACCEPTED" />);
    expect(screen.getByText('Принят')).toBeDefined();
    expect(screen.getByText('Ресторан подтвердил заказ')).toBeDefined();
  });

  it('renders ready status with checkmark', () => {
    render(<OrderStatusBadge status="READY" />);
    expect(screen.getByText('Забирай!')).toBeDefined();
  });
});
