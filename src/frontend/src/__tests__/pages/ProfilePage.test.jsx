import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ProfilePage from '../../pages/profile/ProfilePage';
import { useAuthStore } from '../../store/useAuthStore';
import { staffService } from '../../services/staffService';
import { vendorService } from '../../services/vendorService';

vi.mock('../../store/useAuthStore', () => ({
  useAuthStore: vi.fn((sel) => {
    const state = {
      user: { name: 'Ivan Ivanov', phone_number: '+7999' },
      logout: vi.fn(),
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

vi.mock('../../services/vendorService', () => ({
  vendorService: {
    getMyProfile: vi.fn().mockRejectedValue(new Error('Not a vendor')),
    createProfile: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../services/staffService', () => ({
  staffService: {
    getMyProfile: vi.fn().mockRejectedValue(new Error('Not a staff member')),
  },
}));

vi.mock('../../services/userService', () => ({
  userService: {
    updateMe: vi.fn().mockResolvedValue({}),
    changePassword: vi.fn().mockResolvedValue({}),
  },
}));

describe('ProfilePage', () => {
  const logoutMock = vi.fn();

  const waitForProfileChecks = async () => {
    await waitFor(() => {
      expect(vendorService.getMyProfile).toHaveBeenCalled();
      expect(staffService.getMyProfile).toHaveBeenCalled();
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    staffService.getMyProfile.mockRejectedValue(
      new Error('Not a staff member')
    );
    vi.mocked(useAuthStore).mockImplementation((sel) => {
      const state = {
        user: { name: 'Ivan Ivanov', phone_number: '+7999' },
        logout: logoutMock,
      };
      return sel ? sel(state) : state;
    });
  });

  it('renders user info and settings action', async () => {
    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );

    await waitForProfileChecks();

    expect(screen.getByText('Ivan Ivanov')).toBeDefined();
    expect(screen.getByText('+7999')).toBeDefined();
    expect(screen.getByText('Настройки')).toBeDefined();
  });

  it('calls logout and navigates on click', async () => {
    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );

    fireEvent.click(screen.getByText(/Выйти/));
    expect(logoutMock).toHaveBeenCalled();
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/login');
    });
  });

  it('navigates to orders from menu', async () => {
    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );

    await waitForProfileChecks();

    fireEvent.click(screen.getByText(/Мои заказы/));
    expect(mockNavigate).toHaveBeenCalledWith('/orders');
  });

  it('shows staff dashboard link for staff users', async () => {
    staffService.getMyProfile.mockResolvedValueOnce({
      data: { data: { id: 'staff-1', restaurant_id: 'rest-1', role: 'COOK' } },
    });

    render(
      <BrowserRouter>
        <ProfilePage />
      </BrowserRouter>
    );

    expect(await screen.findByText('Кабинет сотрудника')).toBeDefined();

    fireEvent.click(screen.getByText('Кабинет сотрудника'));
    expect(mockNavigate).toHaveBeenCalledWith('/staff');
  });
});
