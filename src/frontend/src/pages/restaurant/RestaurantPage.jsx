import { useState, useEffect, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { translateApiError } from '../../utils/translateApiError';
import { CATEGORY_RU } from '../../utils/locales';
import {
  Star,
  ChatCircleText,
  Briefcase,
  ForkKnife,
  X,
  Pizza,
  Hamburger,
  BowlFood,
  List,
  Fire,
  ShoppingBag,
  Trash,
  Leaf,
  Cookie,
  Coffee,
  DotsThree,
  PencilSimple,
  Heart,
  ShareNetwork,
  Info,
} from '@phosphor-icons/react';
import { useRestaurantStore } from '../../store/useRestaurantStore';
import { useOrderStore } from '../../store/useOrderStore';
import MenuItemCard from '../../components/ui/MenuItemCard';
import ProductSheet from '../../components/ui/ProductSheet';
import ShareModal from '../../components/ui/ShareModal';
import Pagination from '../../components/ui/Pagination';
import { reviewService } from '../../services/reviewService';
import { staffService } from '../../services/staffService';
import { restaurantService } from '../../services/restaurantService';
import { useAuthStore } from '../../store/useAuthStore';
import { useModalStore } from '../../store/useModalStore';
import { useFavoriteStore } from '../../store/useFavoriteStore';
import { useShallow } from 'zustand/react/shallow';

const CATEGORY_ICONS = {
  SHAURMA: <Fire />,
  BURGER: <Hamburger />,
  PIZZA: <Pizza />,
  SUSHI: <BowlFood />,
  SALAD: <Leaf />,
  SNACK: <Cookie />,
  DRINK: <Coffee />,
  OTHER: <DotsThree />,
};

const formatReviewTime = (value) => {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return '';
  }
};

const ReviewCard = ({ r, currentUserId, onEdit, onDelete }) => (
  <div
    style={{
      padding: '16px',
      background:
        r.user_id === currentUserId ? 'var(--fire-subtle)' : 'var(--bg-card)',
      border: `1px solid ${r.user_id === currentUserId ? 'var(--fire)' : 'var(--border)'}`,
      borderRadius: 'var(--r-md)',
      opacity: r.user_id === currentUserId ? 1 : 0.95,
    }}
  >
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: r.text ? 10 : 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--fire), var(--amber))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '0.75rem',
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          {r.user_id?.slice(0, 1).toUpperCase() || 'U'}
        </div>
        <div>
          <div
            style={{
              fontWeight: 700,
              fontSize: '0.85rem',
              color: 'var(--text-1)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {r.user_name || 'Клиент'}
            {r.user_id === currentUserId && (
              <span
                style={{
                  fontSize: '0.7rem',
                  color: 'var(--fire)',
                  fontWeight: 700,
                }}
              >
                Вы
              </span>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 2,
            }}
          >
            <div style={{ display: 'flex', gap: 1, color: 'var(--fire)' }}>
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  size={11}
                  weight={i < r.rating ? 'fill' : 'regular'}
                />
              ))}
            </div>
            {formatReviewTime(r.created_at) && (
              <span style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>
                {formatReviewTime(r.created_at)}
              </span>
            )}
          </div>
          {r.is_verified_purchase && (
            <span className="verified-purchase-badge" style={{ marginTop: 3 }}>
              <ShoppingBag size={10} weight="fill" />
              Подтверждённый заказ
            </span>
          )}
        </div>
      </div>
      {r.user_id === currentUserId && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            aria-label="Редактировать отзыв"
            onClick={onEdit}
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--r-xs)',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--text-2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <PencilSimple size={13} weight="bold" />
          </button>
          <button
            type="button"
            aria-label="Удалить отзыв"
            onClick={onDelete}
            style={{
              width: 28,
              height: 28,
              borderRadius: 'var(--r-xs)',
              border: '1px solid var(--border)',
              background: 'var(--bg-surface)',
              color: 'var(--error)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <Trash size={13} weight="bold" />
          </button>
        </div>
      )}
    </div>
    {r.text && (
      <p
        style={{
          color: 'var(--text-2)',
          margin: 0,
          lineHeight: 1.6,
          fontSize: '0.875rem',
        }}
      >
        {r.text}
      </p>
    )}
  </div>
);

const RestaurantPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const [restaurantData, setRestaurantData] = useState(
    location.state?.restaurant ?? null
  );
  const [rating, setRating] = useState(null);
  const [reviewCount, setReviewCount] = useState(null);
  const restaurant = restaurantData ?? { id, name: 'Ресторан', address: '' };
  const restaurantUUID = restaurantData?.id?.toString() ?? null;

  const { fetchMenu, menus, loading } = useRestaurantStore(
    useShallow((s) => ({
      fetchMenu: s.fetchMenu,
      menus: s.menus,
      loading: s.loading,
    }))
  );
  const { addToCart } = useOrderStore(
    useShallow((s) => ({
      addToCart: s.addToCart,
    }))
  );

  const [activeCategory, setActiveCategory] = useState('ALL');
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [workingHours, setWorkingHours] = useState([]);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewsList, setReviewsList] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewForm, setReviewForm] = useState({ rating: 5, text: '' });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const currentUser = useAuthStore((s) => s.user);
  const requestConfirm = useModalStore((s) => s.requestConfirm);
  const { favoriteIds, toggle: toggleFavorite } = useFavoriteStore(
    useShallow((s) => ({ favoriteIds: s.favoriteIds, toggle: s.toggle }))
  );
  const isFav = favoriteIds.has(restaurantUUID ?? id);

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffMessage, setStaffMessage] = useState('');
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);

  const menuItems = menus[restaurantUUID ?? id] || [];

  const myReview =
    reviewsList.find((r) => r.user_id === currentUser?.id) ?? null;
  const otherReviews = reviewsList.filter((r) => r.user_id !== currentUser?.id);
  const canReview = currentUser?.permissions?.includes('reviews.create');

  const loadReviews = useCallback(
    (rid) => {
      const target = rid ?? restaurantUUID;
      if (!target) return;
      setReviewsLoading(true);
      reviewService
        .getReviews(target, { page: reviewsPage, size: 10 })
        .then((res) => {
          const list = Array.isArray(res.data?.data) ? res.data.data : [];
          setReviewsList(list);
          setReviewsTotal(res.data?.pagination?.total || 0);
        })
        .finally(() => setReviewsLoading(false));
    },
    [restaurantUUID, reviewsPage]
  );

  const refreshRating = useCallback(
    (rid) => {
      const target = rid ?? restaurantUUID;
      if (!target) return;
      reviewService
        .getRating(target)
        .then((res) => {
          const d = res.data?.data;
          setRating(d?.average_rating ?? d?.rating ?? null);
          setReviewCount(d?.review_count ?? null);
        })
        .catch(() => {});
    },
    [restaurantUUID]
  );

  useEffect(() => {
    if (!location.state?.restaurant) {
      restaurantService
        .getById(id)
        .then((res) => setRestaurantData(res.data.data))
        .catch(() => {});
    }
  }, [id, location.state]);

  useEffect(() => {
    if (!restaurantUUID) return;
    fetchMenu(restaurantUUID);
    refreshRating(restaurantUUID);
    restaurantService
      .getWorkingHours(restaurantUUID)
      .then((res) => setWorkingHours(res.data?.data || []))
      .catch(() => {});
  }, [restaurantUUID, fetchMenu, refreshRating]);

  useEffect(() => {
    if (!restaurantUUID) return;
    loadReviews(restaurantUUID);
  }, [restaurantUUID, loadReviews]);

  const openReviewForm = () => {
    setReviewError('');
    setReviewSuccess(false);
    setReviewForm(
      myReview
        ? { rating: myReview.rating, text: myReview.text ?? '' }
        : { rating: 5, text: '' }
    );
    setReviewFormOpen(true);
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');
    try {
      const rid = restaurantUUID ?? id;
      if (myReview) {
        await reviewService.updateMyReview(rid, {
          text: reviewForm.text || null,
          rating: reviewForm.rating,
        });
      } else {
        await reviewService.createReview(rid, {
          text: reviewForm.text || null,
          rating: reviewForm.rating,
        });
      }
      setReviewFormOpen(false);
      setReviewSuccess(true);
      loadReviews(rid);
      refreshRating(rid);
      window.setTimeout(() => setReviewSuccess(false), 2200);
    } catch (err) {
      setReviewError(translateApiError(err, 'Не удалось отправить отзыв'));
    }
  };

  const handleReviewDelete = async (reviewId) => {
    requestConfirm({
      title: 'Удалить отзыв?',
      message: 'Точно ли вы хотите удалить этот отзыв?',
      confirmLabel: 'Удалить',
      danger: true,
      onConfirm: async () => {
        try {
          await reviewService.deleteReview(restaurantUUID ?? id, reviewId);
          setReviewsList((prev) => prev.filter((r) => r.id !== reviewId));
          refreshRating(restaurantUUID ?? id);
        } catch (err) {
          setReviewError(translateApiError(err, 'Не удалось удалить отзыв'));
        }
      },
    });
  };

  const handleStaffSubmit = async (e) => {
    e.preventDefault();
    setStaffError('');
    setStaffLoading(true);
    try {
      await staffService.createRequest(restaurantUUID ?? id, {
        message: staffMessage,
      });
      setShowStaffModal(false);
      setStaffMessage('');
    } catch {
      setStaffError('Ошибка при отправке заявки');
    } finally {
      setStaffLoading(false);
    }
  };

  const availableMenuItems = menuItems.filter((i) => i.is_available !== false);
  const categories = [
    'ALL',
    ...new Set(availableMenuItems.map((i) => i.category).filter(Boolean)),
  ];
  const filtered =
    activeCategory === 'ALL'
      ? availableMenuItems
      : availableMenuItems.filter((i) => i.category === activeCategory);

  const handleProductAdd = ({ item, selectedOptions, quantity }) => {
    addToCart(item, restaurantUUID ?? id, selectedOptions, quantity);
    setSelectedProduct(null);
  };

  const reviewsButtonLabel = (() => {
    const parts = [];
    if (rating != null) parts.push(`${Number(rating).toFixed(1)}`);
    if (reviewCount != null)
      parts.push(
        `${reviewCount} отзыв${reviewCount === 1 ? '' : reviewCount < 5 ? 'а' : 'ов'}`
      );
    else parts.push('Отзывы');
    return parts.join(' · ');
  })();

  return (
    <div className="page-enter" style={{ minHeight: '100vh' }}>
      <div className="restaurant-hero">
        {restaurant.photo_url ? (
          <img
            className="restaurant-hero-img"
            src={restaurant.photo_url}
            alt={restaurant.name}
            style={{ viewTransitionName: `restaurant-image-${restaurant.id}` }}
          />
        ) : (
          <div className="restaurant-hero-placeholder">
            <ForkKnife size={48} color="rgba(255,255,255,0.3)" />
          </div>
        )}
        <div className="restaurant-hero-overlay" />
        <div className="restaurant-hero-info">
          <h1 className="restaurant-hero-name">{restaurant.name}</h1>
          {restaurant.description && (
            <p
              style={{
                color: 'rgba(255,255,255,0.85)',
                fontSize: '0.875rem',
                margin: '4px 0 8px',
                lineHeight: 1.4,
              }}
            >
              {restaurant.description}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setShowReviewsModal(true);
                setReviewFormOpen(false);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
              }}
            >
              <Star size={14} weight="fill" color="#fbbf24" />
              {reviewsButtonLabel}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowInfoModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
              }}
            >
              <Info size={14} weight="bold" />
              Инфо
            </button>
            <button
              onClick={() => setShowShareModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                cursor: 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
              aria-label="Поделиться рестораном"
            >
              <ShareNetwork size={16} weight="bold" />
            </button>
            {currentUser && (
              <button
                onClick={() => toggleFavorite(restaurant.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: isFav
                    ? 'rgba(239, 68, 68, 0.15)'
                    : 'rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                  border: isFav
                    ? '1px solid var(--error)'
                    : '1px solid rgba(255,255,255,0.2)',
                  color: isFav ? 'var(--error)' : '#fff',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  flexShrink: 0,
                }}
                aria-label={isFav ? 'Убрать из избранного' : 'В избранное'}
                aria-pressed={isFav}
              >
                <Heart size={16} weight={isFav ? 'fill' : 'regular'} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="restaurant-content">
        {restaurant.is_open === false && (
          <div
            style={{
              padding: '12px 16px',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid var(--error)',
              borderRadius: 'var(--r-md)',
              color: 'var(--error)',
              fontSize: '0.85rem',
              fontWeight: 800,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ShieldWarning size={18} weight="fill" />
            Заведение временно закрыто и не принимает заказы
          </div>
        )}
        <div className="menu-categories-scroll">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-chip${activeCategory === cat ? ' active' : ''}`}
              onClick={() => setActiveCategory(cat)}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {cat === 'ALL' ? <List size={14} /> : CATEGORY_ICONS[cat]}
              {cat === 'ALL' ? 'Все' : CATEGORY_RU[cat] || cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="menu-list">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="menu-item"
                style={{ pointerEvents: 'none' }}
              >
                <div
                  className="menu-item-img skeleton"
                  style={{ minHeight: 90, borderRadius: 'var(--r-sm)' }}
                />
                <div
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div
                    className="skeleton"
                    style={{ width: '65%', height: 14 }}
                  />
                  <div
                    className="skeleton"
                    style={{ width: '85%', height: 11 }}
                  />
                  <div
                    className="skeleton"
                    style={{ width: '35%', height: 14, marginTop: 4 }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="menu-list">
            {filtered.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                onSelect={setSelectedProduct}
                isRestaurantOpen={restaurant.is_open !== false}
              />
            ))}
          </div>
        )}

        {restaurant.is_hiring && (
          <button
            className="hiring-hint"
            onClick={() => setShowStaffModal(true)}
          >
            <Briefcase size={14} weight="bold" />
            Заведение ищет сотрудников — откликнуться
          </button>
        )}
      </div>

      {selectedProduct && (
        <ProductSheet
          item={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={handleProductAdd}
          isRestaurantOpen={restaurant.is_open !== false}
        />
      )}

      {showStaffModal && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div
            className="modal-content"
            style={{ maxWidth: '440px', padding: '36px' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '24px',
              }}
            >
              <h2
                style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '1.8rem',
                  fontWeight: 700,
                  color: 'var(--text-1)',
                  margin: 0,
                }}
              >
                Работа
              </h2>
              <button
                onClick={() => setShowStaffModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-3)',
                  display: 'flex',
                }}
              >
                <X size={28} weight="bold" />
              </button>
            </div>

            <p
              style={{
                fontSize: '1rem',
                color: 'var(--text-2)',
                marginBottom: '24px',
                lineHeight: 1.6,
              }}
            >
              Хотите работать в{' '}
              <span style={{ color: 'var(--fire)', fontWeight: 700 }}>
                {restaurant.name}
              </span>
              ?
            </p>

            <form
              onSubmit={handleStaffSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
            >
              <textarea
                className="form-input"
                placeholder="Расскажите о себе..."
                value={staffMessage}
                onChange={(e) => setStaffMessage(e.target.value)}
                rows={5}
                required
                style={{ borderRadius: 'var(--r-md)', resize: 'vertical' }}
              />
              {staffError && <div className="form-error">{staffError}</div>}
              <button
                className="btn btn-primary btn-full"
                type="submit"
                style={{ borderRadius: 'var(--r-md)', height: '52px' }}
              >
                {staffLoading ? 'Отправка...' : 'Отправить заявку'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showReviewsModal && (
        <div className="modal-overlay" style={{ zIndex: 3000 }}>
          <div
            className="modal-content"
            style={{
              maxWidth: '500px',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              padding: '28px 28px 0',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2
                  style={{
                    fontFamily: 'var(--font-serif)',
                    fontSize: '1.6rem',
                    fontWeight: 700,
                    color: 'var(--text-1)',
                    margin: 0,
                  }}
                >
                  Отзывы
                </h2>
                {rating != null && (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      color: 'var(--text-2)',
                      fontSize: '0.9rem',
                    }}
                  >
                    <Star size={14} weight="fill" color="#fbbf24" />
                    {Number(rating).toFixed(1)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {canReview && !reviewFormOpen && (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={openReviewForm}
                    style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                  >
                    {myReview ? (
                      <>
                        <PencilSimple size={13} weight="bold" /> Редактировать
                      </>
                    ) : (
                      <>
                        <Star size={13} weight="bold" /> Оставить отзыв
                      </>
                    )}
                  </button>
                )}
                <button
                  onClick={() => setShowReviewsModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-3)',
                    display: 'flex',
                  }}
                >
                  <X size={26} weight="bold" />
                </button>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 28 }}>
              {reviewFormOpen && (
                <div
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-lg)',
                    padding: '20px',
                    marginBottom: '20px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 16,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: 'var(--text-1)',
                      }}
                    >
                      {myReview ? 'Редактировать отзыв' : 'Оставить отзыв'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setReviewFormOpen(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-3)',
                        display: 'flex',
                      }}
                    >
                      <X size={18} weight="bold" />
                    </button>
                  </div>
                  <form
                    onSubmit={handleReviewSubmit}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        justifyContent: 'center',
                      }}
                    >
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`rating-star${s <= reviewForm.rating ? ' rating-star--selected' : ''}`}
                          size={30}
                          weight={s <= reviewForm.rating ? 'fill' : 'regular'}
                          onClick={() =>
                            setReviewForm({ ...reviewForm, rating: s })
                          }
                        />
                      ))}
                    </div>
                    <textarea
                      className="form-input"
                      placeholder="Ваш отзыв (необязательно)..."
                      value={reviewForm.text}
                      onChange={(e) =>
                        setReviewForm({ ...reviewForm, text: e.target.value })
                      }
                      style={{
                        borderRadius: 'var(--r-md)',
                        background: 'var(--bg-card)',
                        minHeight: '72px',
                      }}
                    />
                    {reviewError && (
                      <div className="form-error">{reviewError}</div>
                    )}
                    <button
                      type="submit"
                      className="btn btn-primary btn-full"
                      style={{ borderRadius: 'var(--r-md)' }}
                    >
                      {myReview ? 'Сохранить' : 'Опубликовать'}
                    </button>
                  </form>
                </div>
              )}

              {reviewSuccess && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: 'var(--r-md)',
                    background: 'var(--color-success)',
                    color: '#fff',
                    fontSize: '0.86rem',
                    fontWeight: 800,
                    marginBottom: 12,
                  }}
                >
                  Отзыв успешно сохранён
                </div>
              )}

              {reviewsLoading && reviewsList.length === 0 ? (
                <div className="loading-center">
                  <div className="spinner" />
                </div>
              ) : reviewsList.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px 0',
                    color: 'var(--text-3)',
                  }}
                >
                  <ChatCircleText
                    size={36}
                    style={{ marginBottom: 8, opacity: 0.4 }}
                  />
                  <div style={{ fontWeight: 600 }}>Отзывов пока нет</div>
                  <div style={{ fontSize: '0.85rem', marginTop: 4 }}>
                    Будьте первым, кто оставит отзыв!
                  </div>
                </div>
              ) : (
                <div
                  className={reviewsLoading ? 'loading-dim' : undefined}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  {myReview && (
                    <ReviewCard
                      r={myReview}
                      currentUserId={currentUser?.id}
                      onEdit={openReviewForm}
                      onDelete={() => handleReviewDelete(myReview.id)}
                    />
                  )}
                  {otherReviews.map((r) => (
                    <ReviewCard
                      key={r.id}
                      r={r}
                      currentUserId={currentUser?.id}
                      onEdit={openReviewForm}
                      onDelete={() => handleReviewDelete(r.id)}
                    />
                  ))}
                  <Pagination
                    page={reviewsPage}
                    totalPages={Math.ceil(reviewsTotal / 10)}
                    onPageChange={setReviewsPage}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <ShareModal
          restaurant={restaurant}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {showInfoModal && (
        <div
          className="modal-overlay"
          onClick={(e) => {
            if (e.target.classList.contains('modal-overlay'))
              setShowInfoModal(false);
          }}
        >
          <div
            className="modal-content info-modal"
            style={{ padding: 24, maxWidth: 400 }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>
                Информация
              </h2>
              <button
                onClick={() => setShowInfoModal(false)}
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '50%',
                  width: 32,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-2)',
                }}
              >
                <X size={16} weight="bold" />
              </button>
            </div>

            <h3
              style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 12 }}
            >
              Рабочие часы
            </h3>
            {workingHours.length > 0 ? (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                {workingHours.map((wh) => {
                  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
                  const dayName =
                    days[wh.day_of_week] ?? days[wh.day_of_week - 1] ?? '';
                  return (
                    <div
                      key={wh.day_of_week}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '0.95rem',
                      }}
                    >
                      <span style={{ color: 'var(--text-2)' }}>{dayName}</span>
                      <span style={{ fontWeight: 600 }}>
                        {wh.is_open
                          ? `${wh.opening_time.slice(0, 5)} - ${wh.closing_time.slice(0, 5)}`
                          : 'Выходной'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ fontSize: '0.95rem', color: 'var(--text-3)' }}>
                Не указаны
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RestaurantPage;
