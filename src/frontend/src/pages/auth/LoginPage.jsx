import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TelegramLogo } from '@phosphor-icons/react';
import { useAuthStore } from '../../store/useAuthStore';
import { ROUTES } from '../../constants/routes';
import FoodizeLogo from '../../components/ui/FoodizeLogo';
import { translateApiError } from '../../utils/translateApiError';
import { formatPhoneNumber, extractPhoneNumber } from '../../utils/phone';
import { authService } from '../../services/authService';
import { userService } from '../../services/userService';

const AuthVisual = () => (
  <div className="auth-visual">
    <div className="auth-visual-pattern" />
    <div className="auth-visual-content">
      <div className="auth-visual-title">
        Еда,
        <br />
        которую
        <br />
        вы <em>любите</em>
      </div>
      <p className="auth-visual-sub">
        Лучшие заведения города — в одном месте. Быстро, удобно, вкусно.
      </p>
    </div>
  </div>
);

const getPasswordStrength = (value) => {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;

  if (!value)
    return { score: 0, label: 'Введите пароль', color: 'var(--border-mid)' };
  if (score <= 2) return { score, label: 'Слабый пароль', color: '#ef4444' };
  if (score <= 4) return { score, label: 'Средний пароль', color: '#f59e0b' };
  return { score, label: 'Сильный пароль', color: '#22c55e' };
};

const PasswordStrength = ({ value }) => {
  const strength = getPasswordStrength(value);
  return (
    <div className="password-strength">
      <div className="password-strength-track">
        <span
          style={{
            width: `${Math.max(1, strength.score) * 20}%`,
            background: strength.color,
          }}
        />
      </div>
      <div style={{ color: strength.color }}>{strength.label}</div>
    </div>
  );
};

const LoginPage = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [telegramPhoneNumber, setTelegramPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [telegramCode, setTelegramCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
  });
  const [authMode, setAuthMode] = useState('password');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const login = useAuthStore((s) => s.login);
  const loginWithTelegramCode = useAuthStore((s) => s.loginWithTelegramCode);
  const setTelegramSitePassword = useAuthStore(
    (s) => s.setTelegramSitePassword
  );
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const cleanPhone = extractPhoneNumber(phoneNumber);
      await login({ phone_number: cleanPhone, password });
      navigate(ROUTES.HOME);
    } catch (err) {
      setError(translateApiError(err, 'Неверный телефон или пароль'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleTelegramCodeRequest = async () => {
    setError('');
    setIsLoading(true);
    try {
      const cleanPhone = extractPhoneNumber(telegramPhoneNumber);
      await authService.requestTelegramLoginCode({ phone_number: cleanPhone });
      setAuthMode('telegram-code');
    } catch (err) {
      setError(
        translateApiError(
          err,
          'Не удалось отправить код. Проверьте номер и привязку Telegram.'
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTelegramCodeSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const cleanPhone = extractPhoneNumber(telegramPhoneNumber);
      const result = await loginWithTelegramCode({
        phone_number: cleanPhone,
        code: telegramCode,
      });
      if (result.requiresPassword) {
        setAuthMode('set-password');
        return;
      }
      navigate(ROUTES.HOME);
    } catch (err) {
      setError(translateApiError(err, 'Неверный код из Telegram'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSetup = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (getPasswordStrength(newPassword).score < 3) {
      setError('Пароль слишком слабый');
      return;
    }
    setIsLoading(true);
    try {
      await setTelegramSitePassword(newPassword);
      if (profileForm.first_name || profileForm.last_name) {
        await userService.updateMe(profileForm);
        await fetchMe();
      }
      navigate(ROUTES.HOME);
    } catch (err) {
      setError(translateApiError(err, 'Не удалось сохранить пароль'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <AuthVisual />

      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-logo">
            <FoodizeLogo size={30} />
          </div>

          <h1 className="auth-heading">
            {authMode === 'set-password'
              ? 'Придумайте пароль'
              : authMode === 'telegram-phone'
                ? 'Вход через Telegram'
                : 'С возвращением'}
          </h1>
          <p className="auth-subheading">
            {authMode === 'set-password'
              ? 'Он понадобится для обычного входа на сайте. Имя и фамилию можно поправить сразу.'
              : authMode === 'telegram-phone'
                ? 'Введите номер аккаунта, и мы отправим код в Telegram'
                : 'Войдите, чтобы сделать заказ'}
          </p>

          {error && (
            <div className="form-error" style={{ marginBottom: 20 }}>
              {error}
            </div>
          )}

          {authMode === 'password' && (
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label" htmlFor="login-phone">
                  Телефон
                </label>
                <input
                  id="login-phone"
                  className="form-input"
                  type="tel"
                  placeholder="+7 (999) 000-00-00"
                  value={phoneNumber}
                  onChange={(e) =>
                    setPhoneNumber(formatPhoneNumber(e.target.value))
                  }
                  required
                  autoComplete="tel"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  Пароль
                </label>
                <input
                  id="login-password"
                  className="form-input"
                  type="password"
                  placeholder="Минимум 8 символов"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="current-password"
                />
              </div>

              <button
                id="login-submit-btn"
                type="submit"
                className="btn btn-primary btn-full"
                disabled={isLoading}
                style={{
                  marginTop: 4,
                  height: '52px',
                  borderRadius: 'var(--r-sm)',
                }}
              >
                {isLoading ? (
                  <span
                    style={{ display: 'flex', alignItems: 'center', gap: 10 }}
                  >
                    <span
                      className="spinner"
                      style={{ width: 18, height: 18 }}
                    />
                    Вход...
                  </span>
                ) : (
                  'Войти'
                )}
              </button>

              <button
                type="button"
                className="btn btn-secondary btn-full"
                disabled={isLoading}
                onClick={() => {
                  setError('');
                  setTelegramPhoneNumber('');
                  setTelegramCode('');
                  setAuthMode('telegram-phone');
                }}
                style={{ height: '52px', borderRadius: 'var(--r-sm)' }}
              >
                <TelegramLogo size={20} weight="fill" />
                Войти через Telegram
              </button>
            </form>
          )}

          {authMode === 'telegram-phone' && (
            <form
              className="auth-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleTelegramCodeRequest();
              }}
              noValidate
            >
              <div className="form-group">
                <label className="form-label" htmlFor="telegram-login-phone">
                  Телефон
                </label>
                <input
                  id="telegram-login-phone"
                  className="form-input"
                  type="tel"
                  placeholder="+7 (999) 000-00-00"
                  value={telegramPhoneNumber}
                  onChange={(e) =>
                    setTelegramPhoneNumber(formatPhoneNumber(e.target.value))
                  }
                  required
                  autoComplete="tel"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={isLoading || !telegramPhoneNumber}
                style={{ height: '52px', borderRadius: 'var(--r-sm)' }}
              >
                {isLoading ? 'Отправляем...' : 'Получить код в Telegram'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-full"
                disabled={isLoading}
                onClick={() => setAuthMode('password')}
              >
                Назад
              </button>
            </form>
          )}

          {authMode === 'telegram-code' && (
            <form
              className="auth-form"
              onSubmit={handleTelegramCodeSubmit}
              noValidate
            >
              <div className="form-group">
                <label className="form-label" htmlFor="telegram-code">
                  Код из Telegram
                </label>
                <input
                  id="telegram-code"
                  className="form-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  value={telegramCode}
                  onChange={(e) =>
                    setTelegramCode(
                      e.target.value.replace(/\D/g, '').slice(0, 6)
                    )
                  }
                  required
                  autoFocus
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={isLoading || telegramCode.length < 4}
                style={{ height: '52px', borderRadius: 'var(--r-sm)' }}
              >
                {isLoading ? 'Проверяем...' : 'Подтвердить код'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-full"
                disabled={isLoading}
                onClick={() => setAuthMode('password')}
              >
                Назад
              </button>
            </form>
          )}

          {authMode === 'set-password' && (
            <form
              className="auth-form"
              onSubmit={handlePasswordSetup}
              noValidate
            >
              <div className="form-group">
                <label className="form-label" htmlFor="telegram-first-name">
                  Имя
                </label>
                <input
                  id="telegram-first-name"
                  className="form-input"
                  type="text"
                  placeholder="Имя"
                  value={profileForm.first_name}
                  onChange={(e) =>
                    setProfileForm((form) => ({
                      ...form,
                      first_name: e.target.value,
                    }))
                  }
                  autoComplete="given-name"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="telegram-last-name">
                  Фамилия
                </label>
                <input
                  id="telegram-last-name"
                  className="form-input"
                  type="text"
                  placeholder="Фамилия"
                  value={profileForm.last_name}
                  onChange={(e) =>
                    setProfileForm((form) => ({
                      ...form,
                      last_name: e.target.value,
                    }))
                  }
                  autoComplete="family-name"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="telegram-new-password">
                  Новый пароль
                </label>
                <input
                  id="telegram-new-password"
                  className="form-input"
                  type="password"
                  placeholder="Минимум 8 символов"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                />
                <PasswordStrength value={newPassword} />
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="telegram-confirm-password"
                >
                  Повторите пароль
                </label>
                <input
                  id="telegram-confirm-password"
                  className="form-input"
                  type="password"
                  placeholder="Ещё раз новый пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={
                  isLoading ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
                style={{ height: '52px', borderRadius: 'var(--r-sm)' }}
              >
                {isLoading ? 'Сохраняем...' : 'Сохранить пароль'}
              </button>
            </form>
          )}

          <div className="auth-footer">
            Нет аккаунта? <Link to={ROUTES.REGISTER}>Зарегистрироваться</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
