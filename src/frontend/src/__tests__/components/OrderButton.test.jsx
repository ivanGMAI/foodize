import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OrderButton from '../../components/ui/OrderButton';

describe('OrderButton', () => {
  it('renders children correctly', () => {
    render(<OrderButton>Order Now</OrderButton>);
    expect(screen.getByText('Order Now')).toBeDefined();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<OrderButton onClick={onClick}>Click Me</OrderButton>);

    fireEvent.click(screen.getByText('Click Me'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows spinner when loading', () => {
    const { container } = render(<OrderButton isLoading>Submit</OrderButton>);
    expect(screen.queryByText('Submit')).toBeNull();
    expect(container.querySelector('.spinner')).toBeDefined();
    expect(screen.getByText('Оформление...')).toBeDefined();
  });

  it('applies scale animation on press', () => {
    render(<OrderButton>Haptic</OrderButton>);
    const button = screen.getByText('Haptic');

    fireEvent.mouseDown(button);
    expect(button.style.transform).toBe('scale(0.96)');

    fireEvent.mouseUp(button);
    expect(button.style.transform).toBe('scale(1)');
  });
});
