import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore } from '../../store/useAuthStore';
import { authService } from '../../services/authService';

// Mock authService
vi.mock('../../services/authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    getMe: vi.fn(),
    logout: vi.fn(),
    verifyTelegramLoginCode: vi.fn(),
    setTelegramSitePassword: vi.fn(),
  },
}));

describe('useAuthStore', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  it('initial state is correct', () => {
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBe(null);
  });

  it('login updates state on success', async () => {
    const mockUser = { id: '1', name: 'Test' };
    const mockToken = 'token123';
    authService.login.mockResolvedValueOnce({
      data: { data: { access_token: mockToken } },
    });
    authService.getMe.mockResolvedValueOnce({ data: { data: mockUser } });

    await useAuthStore
      .getState()
      .login({ phone_number: '123', password: 'pw' });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
    expect(localStorage.getItem('access_token')).toBe(mockToken);
  });

  it('login propagates errors', async () => {
    const errorMsg = 'Wrong credentials';
    authService.login.mockRejectedValueOnce(new Error(errorMsg));

    await expect(
      useAuthStore.getState().login({ phone_number: '123', password: 'pw' })
    ).rejects.toThrow(errorMsg);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });

  it('logout clears state', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: '1' } });
    localStorage.setItem('access_token', 'tk');

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBe(null);
    expect(localStorage.getItem('access_token')).toBe(null);
  });

  it('loginWithTelegramCode stores token, user and password requirement', async () => {
    const mockUser = { id: 'tg-user', name: 'Telegram User' };
    authService.verifyTelegramLoginCode.mockResolvedValueOnce({
      data: { data: { access_token: 'tg-token', requires_password: true } },
    });
    authService.getMe.mockResolvedValueOnce({ data: { data: mockUser } });

    const result = await useAuthStore
      .getState()
      .loginWithTelegramCode({ code: '123456' });

    expect(result).toEqual({ requiresPassword: true });
    expect(localStorage.getItem('access_token')).toBe('tg-token');
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('setTelegramSitePassword refreshes current user after saving password', async () => {
    const mockUser = { id: 'tg-user', name: 'Telegram User' };
    authService.setTelegramSitePassword.mockResolvedValueOnce({});
    authService.getMe.mockResolvedValueOnce({ data: { data: mockUser } });

    await useAuthStore.getState().setTelegramSitePassword('strongpassword');

    expect(authService.setTelegramSitePassword).toHaveBeenCalledWith({
      password: 'strongpassword',
    });
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('fetchMe clears auth state when current user request fails', async () => {
    useAuthStore.setState({ isAuthenticated: true, user: { id: '1' } });
    authService.getMe.mockRejectedValueOnce(new Error('expired'));

    await useAuthStore.getState().fetchMe();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBe(null);
  });
});
