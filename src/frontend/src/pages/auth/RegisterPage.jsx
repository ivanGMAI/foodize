import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { ROUTES } from '../../constants/routes';
import FoodizeLogo from '../../components/ui/FoodizeLogo';
import { translateApiError } from '../../utils/translateApiError';
import { useShallow } from 'zustand/react/shallow';
import { formatPhoneNumber, extractPhoneNumber } from '../../utils/phone';

const AuthVisual = () => (
  <div className="auth-visual">
    <div className="auth-visual-pattern" />
    <div className="auth-visual-content">
      <div className="auth-visual-title">
        Начни
        <br />
        своё <em>вкусное</em>
        <br />
        путешествие
      </div>
      <p className="auth-visual-sub">
        Зарегистрируйтесь за 30 секунд и откройте доступ к лучшим заведениям
        города.
      </p>
    </div>
  </div>
);

const RegisterPage = () => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register, login } = useAuthStore(
    useShallow((s) => ({
      register: s.register,
      login: s.login,
    }))
  );
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const cleanPhone = extractPhoneNumber(phone);
      await register({
        name,
        phone_number: cleanPhone,
        email: email || null,
        password,
      });
      await login({ phone_number: cleanPhone, password });
      navigate(ROUTES.HOME);
    } catch (err) {
      setError(translateApiError(err, 'Ошибка при регистрации'));
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

          <h1 className="auth-heading">Создать аккаунт</h1>
          <p className="auth-subheading">Быстро и без лишних шагов</p>

          {error && (
            <div className="form-error" style={{ marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            <div className="form-group">
              <label className="form-label" htmlFor="reg-name">
                Имя
              </label>
              <input
                id="reg-name"
                className="form-input"
                type="text"
                placeholder="Ваше имя"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                autoComplete="name"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-phone">
                Телефон
              </label>
              <input
                id="reg-phone"
                className="form-input"
                type="tel"
                placeholder="+7 (999) 000-00-00"
                value={phone}
                onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
                required
                autoComplete="tel"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-email">
                Email (необязательно)
              </label>
              <input
                id="reg-email"
                className="form-input"
                type="email"
                placeholder="mail@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="reg-password">
                Пароль
              </label>
              <input
                id="reg-password"
                className="form-input"
                type="password"
                placeholder="Минимум 8 символов"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button
              id="register-submit-btn"
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
                  <span className="spinner" style={{ width: 18, height: 18 }} />
                  Создаём аккаунт...
                </span>
              ) : (
                'Создать аккаунт'
              )}
            </button>
          </form>

          <div className="auth-footer">
            Уже есть аккаунт? <Link to={ROUTES.LOGIN}>Войти</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
