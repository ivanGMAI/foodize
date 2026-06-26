import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import FoodizeLogo from '../../components/ui/FoodizeLogo';

describe('FoodizeLogo', () => {
  it('renders the logo text', () => {
    render(<FoodizeLogo />);
    expect(screen.getByText('food')).toBeDefined();
    expect(screen.getByText('ize')).toBeDefined();
  });

  it('applies the correct font size from size prop', () => {
    const { container } = render(<FoodizeLogo size={64} />);
    const span = container.firstChild.querySelector('span');
    expect(span.style.fontSize).toBe('64px');
  });

  it('uses custom color when provided', () => {
    const { container } = render(<FoodizeLogo color="#FF4F1F" />);
    const span = container.firstChild.querySelector('span');
    expect(span.style.color).toBe('rgb(255, 79, 31)');
  });

  it('uses currentColor when no color prop provided', () => {
    const { container } = render(<FoodizeLogo />);
    const span = container.firstChild.querySelector('span');
    expect(span.style.color).toBe('currentcolor');
  });
});
