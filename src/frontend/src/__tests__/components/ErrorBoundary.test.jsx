import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../../components/ui/ErrorBoundary';

let shouldThrow = false;

const ConditionalBroken = () => {
  if (shouldThrow) throw new Error('Boom');
  return <div>Recovered</div>;
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Healthy child</div>
      </ErrorBoundary>
    );

    expect(screen.getByText('Healthy child')).toBeInTheDocument();
  });

  it('shows fallback and can retry after an error', () => {
    shouldThrow = true;
    render(
      <ErrorBoundary>
        <ConditionalBroken />
      </ErrorBoundary>
    );

    expect(screen.getByText('Boom')).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Попробовать снова' }));

    expect(screen.getByText('Recovered')).toBeInTheDocument();
  });
});
