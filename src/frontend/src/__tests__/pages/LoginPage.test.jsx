import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from '../../pages/auth/LoginPage';
import { useAuthStore } from '../../store/useAuthStore';

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: vi.fn((selector) => {
    const state = {
      login: vi.fn(),
      isAuthenticated: false,
      error: null,
    };
    return selector ? selector(state) : state;
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

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form correctly', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    expect(screen.getByLabelText('Телефон')).toBeDefined();
    expect(screen.getByLabelText('Пароль')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Войти' })).toBeDefined();
  });

  it('calls login and navigates on successful submit', async () => {
    const mockLogin = vi.fn().mockResolvedValueOnce();
    vi.mocked(useAuthStore).mockImplementation((sel) => {
      const state = { login: mockLogin, isAuthenticated: false };
      return sel ? sel(state) : state;
    });

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText('Телефон'), {
      target: { value: '+7123' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        phone_number: '+7123',
        password: 'password123',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows translated error message if login fails', async () => {
    const mockLogin = vi.fn().mockRejectedValueOnce({
      response: { data: { detail: 'Invalid credentials' } },
    });
    vi.mocked(useAuthStore).mockImplementation((sel) => {
      const state = { login: mockLogin, isAuthenticated: false };
      return sel ? sel(state) : state;
    });

    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Войти' }));

    await waitFor(() => {
      expect(screen.getByText('Неверный телефон или пароль')).toBeDefined();
    });
  });
});
