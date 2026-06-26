import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import RegisterPage from '../../pages/auth/RegisterPage';
import { useAuthStore } from '../../store/useAuthStore';

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: vi.fn((sel) => {
    const state = {
      register: vi.fn(),
      login: vi.fn(),
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

describe('RegisterPage', () => {
  const registerMock = vi.fn();
  const loginMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockImplementation((sel) => {
      const state = {
        register: registerMock,
        login: loginMock,
      };
      return sel ? sel(state) : state;
    });
  });

  it('renders registration form', () => {
    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    expect(screen.getByLabelText('Имя')).toBeDefined();
    expect(screen.getByLabelText('Телефон')).toBeDefined();
    expect(screen.getByLabelText('Пароль')).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Создать аккаунт' })
    ).toBeDefined();
  });

  it('registers without client-side role assignment', async () => {
    registerMock.mockResolvedValueOnce();
    loginMock.mockResolvedValueOnce();

    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByLabelText('Телефон'), {
      target: { value: '79991234567' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test',
          phone_number: '+79991234567',
          password: 'password123',
          email: null,
        })
      );
      expect(registerMock.mock.calls[0][0]).not.toHaveProperty('user_role');
    });
  });

  it('registers and logs in on submit', async () => {
    registerMock.mockResolvedValueOnce();
    loginMock.mockResolvedValueOnce();

    render(
      <BrowserRouter>
        <RegisterPage />
      </BrowserRouter>
    );

    fireEvent.change(screen.getByLabelText('Имя'), {
      target: { value: 'Ivan' },
    });
    fireEvent.change(screen.getByLabelText('Телефон'), {
      target: { value: '111' },
    });
    fireEvent.change(screen.getByLabelText('Пароль'), {
      target: { value: 'pw123456' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Создать аккаунт' }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Ivan',
          phone_number: '+7111',
          password: 'pw123456',
          email: null,
        })
      );
      expect(registerMock.mock.calls[0][0]).not.toHaveProperty('user_role');
      expect(loginMock).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });
});
