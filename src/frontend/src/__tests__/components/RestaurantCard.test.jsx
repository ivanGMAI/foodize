import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RestaurantCard from '../../components/ui/RestaurantCard';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
});
window.IntersectionObserver = mockIntersectionObserver;

describe('RestaurantCard', () => {
  const restaurant = {
    id: '1',
    name: 'Burger King',
    address: 'Street 1',
    category: 'BURGER',
    photo_url: 'burger.jpg',
  };

  it('renders restaurant details correctly', () => {
    render(<RestaurantCard restaurant={restaurant} />);

    expect(screen.getByText('Burger King')).toBeDefined();
    expect(screen.getByText('Street 1')).toBeDefined();
    expect(screen.getByText('BURGER')).toBeDefined();

    const img = screen.getByAltText('Burger King');
    expect(img.getAttribute('src')).toBe('burger.jpg');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<RestaurantCard restaurant={restaurant} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders emoji placeholder if no photo_url', () => {
    const noPhotoRest = { ...restaurant, photo_url: null };
    const { container } = render(<RestaurantCard restaurant={noPhotoRest} />);

    expect(container.querySelector('.card-photo-placeholder')).toBeDefined();
  });
});
