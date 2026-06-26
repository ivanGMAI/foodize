import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MapPin, ArrowLeft } from '@phosphor-icons/react';
import { favoriteService } from '../../services/favoriteService';
import { useFavoriteStore } from '../../store/useFavoriteStore';
import { ROUTES } from '../../constants/routes';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';

const FavoritesPage = () => {
  const navigate = useNavigate();
  const { toggle } = useFavoriteStore();
  const [favorites, setFavorites] = useState([]);
  const [favPage, setFavPage] = useState(1);
  const [favTotal, setFavTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const FAV_PAGE_SIZE = 20;

  useEffect(() => {
    setLoading(true);
    favoriteService
      .getAll({ page: favPage, size: FAV_PAGE_SIZE })
      .then((res) => {
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setFavorites(list);
        setFavTotal(res.data?.pagination?.total || 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [favPage]);

  const handleUnfavorite = async (restaurantId) => {
    await toggle(restaurantId);
    setFavorites((prev) =>
      prev.filter((f) => f.restaurant.id !== restaurantId)
    );
    setFavTotal((prev) => Math.max(0, prev - 1));
  };

  const handleCardClick = (restaurant) => {
    navigate(
      ROUTES.RESTAURANT.replace(':id', restaurant.display_id || restaurant.id),
      {
        state: { restaurant },
      }
    );
  };

  return (
    <div
      className="page-enter"
      style={{ padding: '80px 20px 100px', maxWidth: 640, margin: '0 auto' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 28,
        }}
      >
        <button
          onClick={() => navigate(ROUTES.PROFILE)}
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            borderRadius: '50%',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-2)',
          }}
        >
          <ArrowLeft size={18} weight="bold" />
        </button>
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.6rem',
            fontWeight: 700,
            margin: 0,
            letterSpacing: '-0.02em',
          }}
        >
          Избранное
        </h1>
        {favTotal > 0 && (
          <span
            style={{
              background: 'var(--fire-subtle)',
              color: 'var(--fire)',
              borderRadius: '100px',
              padding: '2px 10px',
              fontSize: '0.75rem',
              fontWeight: 800,
            }}
          >
            {favTotal}
          </span>
        )}
      </div>

      {loading && favorites.length === 0 ? (
        <div className="loading-center">
          <div className="spinner" />
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          title="Нет избранных"
          subtitle="Нажмите ❤ на карточке ресторана, чтобы сохранить"
        />
      ) : (
        <div
          className={loading ? 'loading-dim' : undefined}
          style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {favorites.map(({ id: favId, restaurant }) => (
            <div
              key={favId}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-md)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                cursor: 'pointer',
                transition:
                  'border-color var(--dur-sm), transform var(--dur-sm)',
              }}
              onClick={() => handleCardClick(restaurant)}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-mid)';
                e.currentTarget.style.transform = 'translateX(3px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {/* Status dot */}
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: restaurant.is_open ? '#22c55e' : '#6b7280',
                  flexShrink: 0,
                  boxShadow: restaurant.is_open
                    ? '0 0 6px rgba(34,197,94,0.6)'
                    : 'none',
                }}
              />

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    color: 'var(--text-1)',
                    marginBottom: 4,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {restaurant.name}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '0.78rem',
                    color: 'var(--text-3)',
                  }}
                >
                  <MapPin size={11} weight="bold" />
                  <span
                    style={{
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {restaurant.address}
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: 4,
                }}
              >
                <span
                  style={{
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: restaurant.is_open ? '#22c55e' : '#9ca3af',
                  }}
                >
                  {restaurant.is_open ? 'Открыто' : 'Закрыто'}
                </span>
              </div>

              {/* Unfavorite button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnfavorite(restaurant.id);
                }}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                  transition: 'background var(--dur-sm)',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'rgba(239,68,68,0.16)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')
                }
                aria-label="Убрать из избранного"
              >
                <Heart size={16} weight="fill" color="#ef4444" />
              </button>
            </div>
          ))}
          <Pagination
            page={favPage}
            totalPages={Math.ceil(favTotal / FAV_PAGE_SIZE)}
            onPageChange={setFavPage}
          />
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
