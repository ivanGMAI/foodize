import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Outlet } from 'react-router-dom';
import { translateApiError } from '../../utils/translateApiError';
import { User, SignIn, ShoppingCart } from '@phosphor-icons/react';

import FoodizeLogo from '../ui/FoodizeLogo';
import ThemeToggle from '../ui/ThemeToggle';
import CartDrawer from '../ui/CartDrawer';
import NotificationBell from '../ui/NotificationBell';
import OrderAssistant from '../ui/OrderAssistant';

import { useAuthStore } from '../../store/useAuthStore';
import { useOrderStore } from '../../store/useOrderStore';
import { useShallow } from 'zustand/react/shallow';
import { ROUTES } from '../../constants/routes';

const MainLayout = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { cart, placeOrder, cartTotal } = useOrderStore(
    useShallow((s) => ({
      cart: s.cart,
      placeOrder: s.placeOrder,
      cartTotal: s.cartTotal,
    }))
  );
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [badgePop, setBadgePop] = useState(false);
  const previousCartItemsCount = useRef(0);

  const cartItemsCount = cart.reduce((t, i) => t + i.quantity, 0);

  useEffect(() => {
    if (cartItemsCount > previousCartItemsCount.current) {
      setBadgePop(false);
      const frame = window.requestAnimationFrame(() => setBadgePop(true));
      const timer = window.setTimeout(() => setBadgePop(false), 520);
      previousCartItemsCount.current = cartItemsCount;
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
    }
    previousCartItemsCount.current = cartItemsCount;
  }, [cartItemsCount]);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg?.initDataUnsafe?.start_param) {
      const startParam = tg.initDataUnsafe.start_param;
      if (startParam.startsWith('restaurant_')) {
        const displayId = startParam.replace('restaurant_', '');
        navigate(ROUTES.RESTAURANT.replace(':id', displayId));
      } else if (startParam.startsWith('order_')) {
        const displayId = startParam.replace('order_', '');
        navigate(ROUTES.ORDER_STATUS.replace(':id', displayId));
      }
    }
  }, [navigate]);

  const handleCheckout = async (
    promoCode = null,
    comment = '',
    requestedPickupAt = null
  ) => {
    setIsLoading(true);
    setError('');
    try {
      const order = await placeOrder(promoCode, comment, requestedPickupAt);
      setIsCartOpen(false);
      navigate(ROUTES.ORDER_STATUS.replace(':id', order.id));
    } catch (err) {
      setError(translateApiError(err, 'Не удалось разместить заказ'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="layout">
      <header className="header">
        <Link to={ROUTES.HOME} className="header-logo" aria-label="На главную">
          <FoodizeLogo size={26} />
        </Link>

        <div className="header-actions">
          {isAuthenticated && (
            <Link
              to={ROUTES.PROFILE}
              className={`nav-link${location.pathname.startsWith(ROUTES.PROFILE) ? ' active' : ''}`}
              aria-label="Профиль"
            >
              <User size={18} weight="bold" />
              Профиль
            </Link>
          )}
          {isAuthenticated && <NotificationBell />}
          <ThemeToggle />
          {!isAuthenticated && (
            <Link
              to={ROUTES.LOGIN}
              className="btn btn-primary btn-sm"
              id="header-login-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <SignIn size={16} weight="bold" />
              Войти
            </Link>
          )}
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>

      {cartItemsCount > 0 && (
        <button
          className="cart-fab"
          onClick={() => setIsCartOpen(true)}
          aria-label="Открыть корзину"
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShoppingCart size={20} weight="fill" />
            <span>Корзина</span>
            <span className={`cart-badge${badgePop ? ' cart-badge-pop' : ''}`}>
              {cartItemsCount}
            </span>
          </div>
          <span style={{ fontWeight: 800 }}>{cartTotal()} ₽</span>
        </button>
      )}

      {isCartOpen && (
        <CartDrawer
          onClose={() => setIsCartOpen(false)}
          onCheckout={handleCheckout}
          isLoading={isLoading}
          error={error}
        />
      )}

      {isAuthenticated && <OrderAssistant />}
    </div>
  );
};

export default MainLayout;
