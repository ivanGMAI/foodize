import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { translateApiError } from '../../utils/translateApiError';
import {
  Package,
  Crown,
  Storefront,
  CookingPot,
  Sparkle,
  SignOut,
  CaretRight,
  UserCircle,
  Heart,
  GearSix,
  CaretDown,
} from '@phosphor-icons/react';
import { useAuthStore } from '../../store/useAuthStore';
import { ROUTES } from '../../constants/routes';
import { vendorService } from '../../services/vendorService';
import { staffService } from '../../services/staffService';
import { userService } from '../../services/userService';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';

import { useShallow } from 'zustand/react/shallow';

const ProfilePage = () => {
  const { user, logout, fetchMe } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      logout: s.logout,
      fetchMe: s.fetchMe,
    }))
  );
  const navigate = useNavigate();

  const [isVendor, setIsVendor] = useState(false);
  const [checkingVendor, setCheckingVendor] = useState(true);
  const [vendorProfile, setVendorProfile] = useState(null);
  const [isStaff, setIsStaff] = useState(false);
  const [checkingStaff, setCheckingStaff] = useState(true);
  const [vendorLoading, setVendorLoading] = useState(false);
  const [vendorError, setVendorError] = useState('');

  const [settingsTab, setSettingsTab] = useState('profile');
  const [showSettingsInline, setShowSettingsInline] = useState(false);

  const [editForm, setEditForm] = useState({
    name: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    email: '',
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState(false);

  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const isAdmin = hasPermission(user, PERMISSIONS.ADMIN_ACCESS);
  const canOpenVendorDashboard =
    isAdmin || vendorProfile?.approval_status === 'APPROVED';

  useEffect(() => {
    vendorService
      .getMyProfile()
      .then((profile) => {
        setIsVendor(true);
        setVendorProfile(profile.data?.data ?? null);
      })
      .catch(() => {
        setIsVendor(false);
        setVendorProfile(null);
      })
      .finally(() => setCheckingVendor(false));

    staffService
      .getMyProfile()
      .then(() => setIsStaff(true))
      .catch(() => setIsStaff(false))
      .finally(() => setCheckingStaff(false));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  };

  const handleBecomeVendor = async () => {
    setVendorLoading(true);
    setVendorError('');
    try {
      const profile = await vendorService.createProfile({ description: '' });
      setIsVendor(true);
      setVendorProfile(profile.data?.data ?? null);
    } catch (err) {
      setVendorError(translateApiError(err, 'Не удалось стать вендором'));
      setVendorLoading(false);
    } finally {
      setVendorLoading(false);
    }
  };

  const openSettings = () => {
    if (!showSettingsInline) {
      setEditForm({
        name: user?.name ?? '',
        first_name: user?.first_name ?? '',
        last_name: user?.last_name ?? '',
        middle_name: user?.middle_name ?? '',
        email: user?.email ?? '',
      });
      setEditError('');
      setEditSuccess(false);
      setPwForm({ old_password: '', new_password: '' });
      setPwError('');
      setPwSuccess(false);
      setSettingsTab('profile');
    }
    setShowSettingsInline((v) => !v);
  };

  const handleEditSave = async () => {
    setEditLoading(true);
    setEditError('');
    setEditSuccess(false);
    try {
      await userService.updateMe(editForm);
      await fetchMe();
      setEditSuccess(true);
    } catch {
      setEditError('Не удалось сохранить изменения');
    } finally {
      setEditLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwLoading(true);
    setPwError('');
    setPwSuccess(false);
    try {
      await userService.changePassword(pwForm);
      setPwSuccess(true);
      setPwForm({ old_password: '', new_password: '' });
    } catch (err) {
      setPwError(translateApiError(err, 'Не удалось сменить пароль'));
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <div className="profile-page page-enter">
      <div className="profile-header">
        <div className="profile-avatar">
          <UserCircle size={36} weight="bold" color="var(--fire-text)" />
        </div>

        <div style={{ flex: 1 }}>
          <div className="profile-name">
            {user?.first_name && user?.last_name
              ? `${user.first_name} ${user.last_name}`
              : user?.name || 'Пользователь'}
          </div>
          <div className="profile-phone">{user?.phone_number || '—'}</div>
          {user?.email && (
            <div
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-3)',
                marginTop: 2,
              }}
            >
              {user.email}
            </div>
          )}
        </div>
      </div>

      {vendorError && (
        <div className="form-error" style={{ margin: '12px 0' }}>
          {vendorError}
        </div>
      )}

      <div className="profile-menu">
        {/* Orders */}
        <div
          id="profile-orders-link"
          className="profile-menu-item"
          onClick={() => navigate(ROUTES.ORDERS)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate(ROUTES.ORDERS)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Package size={20} weight="bold" />
            <span>Мои заказы</span>
          </div>
          <CaretRight size={16} color="var(--text-3)" />
        </div>

        {/* Favorites */}
        <div
          id="profile-favorites-link"
          className="profile-menu-item"
          onClick={() => navigate(ROUTES.FAVORITES)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate(ROUTES.FAVORITES)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Heart size={20} weight="bold" color="#ef4444" />
            <span>Избранное</span>
          </div>
          <CaretRight size={16} color="var(--text-3)" />
        </div>

        {/* Admin */}
        {isAdmin && (
          <div
            id="profile-admin-dashboard-link"
            className="profile-menu-item"
            onClick={() => navigate(ROUTES.ADMIN)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <Crown size={20} weight="bold" color="var(--gold, #e8a200)" />
              <span>Админ-панель</span>
            </div>
            <CaretRight size={16} color="var(--text-3)" />
          </div>
        )}

        {/* Staff */}
        {!checkingStaff && isStaff && (
          <div
            id="profile-staff-dashboard-link"
            className="profile-menu-item"
            onClick={() => navigate(ROUTES.STAFF_DASHBOARD)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) =>
              e.key === 'Enter' && navigate(ROUTES.STAFF_DASHBOARD)
            }
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <CookingPot size={20} weight="bold" color="var(--fire)" />
              <span>Кабинет сотрудника</span>
            </div>
            <CaretRight size={16} color="var(--text-3)" />
          </div>
        )}

        {/* Vendor */}
        {!checkingVendor &&
          (isVendor || isAdmin ? (
            canOpenVendorDashboard ? (
              <div
                id="profile-vendor-dashboard-link"
                className="profile-menu-item"
                onClick={() => navigate(ROUTES.VENDOR_DASHBOARD)}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
                >
                  <Storefront size={20} weight="bold" />
                  <span>Кабинет вендора</span>
                </div>
                <CaretRight size={16} color="var(--text-3)" />
              </div>
            ) : (
              <div
                id="profile-vendor-pending-status"
                className="profile-menu-item"
                style={{
                  pointerEvents: 'none',
                  opacity: 0.6,
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
                >
                  <Storefront size={20} weight="bold" />
                  <div>
                    <div>Кабинет вендора</div>
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-3)',
                        marginTop: 2,
                      }}
                    >
                      Ожидание одобрения администратором
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div
              id="profile-become-vendor-link"
              className="profile-menu-item"
              onClick={handleBecomeVendor}
              style={{
                pointerEvents: vendorLoading ? 'none' : 'auto',
                opacity: vendorLoading ? 0.6 : 1,
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '14px' }}
              >
                <Sparkle size={20} weight="bold" color="var(--fire)" />
                <span>{vendorLoading ? 'Загрузка...' : 'Стать вендором'}</span>
              </div>
              <CaretRight size={16} color="var(--text-3)" />
            </div>
          ))}

        <div
          className="profile-menu-item"
          onClick={openSettings}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && openSettings()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <GearSix size={20} weight="bold" />
            <span>Настройки</span>
          </div>
          {showSettingsInline ? (
            <CaretDown size={16} color="var(--text-3)" />
          ) : (
            <CaretRight size={16} color="var(--text-3)" />
          )}
        </div>

        {showSettingsInline && (
          <div style={{ padding: '8px 0 4px' }}>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 16,
                borderBottom: '1px solid var(--border)',
                paddingBottom: 12,
              }}
            >
              <button
                className={`btn btn-sm ${settingsTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSettingsTab('profile')}
              >
                Данные профиля
              </button>
              <button
                className={`btn btn-sm ${settingsTab === 'password' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSettingsTab('password')}
              >
                Пароль
              </button>
            </div>

            {settingsTab === 'profile' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <label
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-3)',
                    fontWeight: 700,
                  }}
                >
                  Отображаемое имя
                </label>
                <input
                  className="form-input"
                  placeholder="Отображаемое имя"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
                <label
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-3)',
                    fontWeight: 700,
                    marginTop: 4,
                  }}
                >
                  ФИО
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder="Имя"
                    value={editForm.first_name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, first_name: e.target.value }))
                    }
                  />
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder="Фамилия"
                    value={editForm.last_name}
                    onChange={(e) =>
                      setEditForm((f) => ({ ...f, last_name: e.target.value }))
                    }
                  />
                </div>
                <input
                  className="form-input"
                  placeholder="Отчество"
                  value={editForm.middle_name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, middle_name: e.target.value }))
                  }
                />
                <label
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-3)',
                    fontWeight: 700,
                    marginTop: 4,
                  }}
                >
                  Email
                </label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="Email"
                  value={editForm.email}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, email: e.target.value }))
                  }
                />
                {editError && (
                  <div className="form-error" style={{ fontSize: '0.78rem' }}>
                    {editError}
                  </div>
                )}
                {editSuccess && (
                  <div
                    style={{
                      color: '#22c55e',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                    }}
                  >
                    ✓ Данные сохранены
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  onClick={handleEditSave}
                  disabled={editLoading}
                  style={{ marginTop: 4 }}
                >
                  {editLoading ? '...' : 'Сохранить'}
                </button>
              </div>
            )}

            {settingsTab === 'password' && (
              <form
                onSubmit={handlePasswordChange}
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <label
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-3)',
                    fontWeight: 700,
                  }}
                >
                  Текущий пароль
                </label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Текущий пароль"
                  value={pwForm.old_password}
                  onChange={(e) =>
                    setPwForm((f) => ({ ...f, old_password: e.target.value }))
                  }
                  required
                />
                <label
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-3)',
                    fontWeight: 700,
                    marginTop: 4,
                  }}
                >
                  Новый пароль
                </label>
                <input
                  className="form-input"
                  type="password"
                  placeholder="Минимум 8 символов"
                  value={pwForm.new_password}
                  onChange={(e) =>
                    setPwForm((f) => ({ ...f, new_password: e.target.value }))
                  }
                  minLength={8}
                  required
                />
                {pwError && (
                  <div className="form-error" style={{ fontSize: '0.78rem' }}>
                    {pwError}
                  </div>
                )}
                {pwSuccess && (
                  <div
                    style={{
                      color: '#22c55e',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                    }}
                  >
                    ✓ Пароль изменён
                  </div>
                )}
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={pwLoading}
                  style={{ marginTop: 4 }}
                >
                  {pwLoading ? '...' : 'Сменить пароль'}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="divider" style={{ margin: '8px 0' }} />

        <div
          id="profile-logout-btn"
          className="profile-menu-item danger"
          onClick={handleLogout}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && handleLogout()}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <SignOut size={20} weight="bold" />
            <span>Выйти</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
