import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlass,
  Storefront,
  Faders,
  SortAscending,
  SortDescending,
  Star,
  ChartBar,
} from '@phosphor-icons/react';
import RestaurantCard from '../../components/ui/RestaurantCard';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import { useAuthStore } from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';
import { useRestaurantStore } from '../../store/useRestaurantStore';
import { ROUTES } from '../../constants/routes';

const HomePage = () => {
  const [search, setSearch] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sort, setSort] = useState('default');
  const [direction, setDirection] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);
  const { isAuthenticated } = useAuthStore(
    useShallow((s) => ({ isAuthenticated: s.isAuthenticated }))
  );
  const {
    publicRestaurants,
    publicRestaurantsTotal,
    fetchPublicRestaurants,
    loading,
  } = useRestaurantStore(
    useShallow((s) => ({
      publicRestaurants: s.publicRestaurants,
      publicRestaurantsTotal: s.publicRestaurantsTotal,
      fetchPublicRestaurants: s.fetchPublicRestaurants,
      loading: s.loading,
    }))
  );
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const size = 20;
  const filterRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setShowFilters(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, onlyOpen, sort, direction]);

  useEffect(() => {
    const handler = setTimeout(() => {
      fetchPublicRestaurants({
        name: search || undefined,
        is_open: onlyOpen ? true : undefined,
        sort,
        direction,
        page,
        size,
      });
    }, 400);
    return () => clearTimeout(handler);
  }, [search, onlyOpen, sort, direction, page, fetchPublicRestaurants]);

  const handleCardClick = (restaurant) => {
    if (!isAuthenticated) {
      navigate(ROUTES.LOGIN);
      return;
    }
    navigate(
      ROUTES.RESTAURANT.replace(':id', restaurant.display_id || restaurant.id),
      {
        state: { restaurant },
        viewTransition: true,
      }
    );
  };

  return (
    <div className="home-page page-enter">
      <div className="search-bar-wrap">
        <div className="search-bar" style={{ flex: 1 }}>
          <MagnifyingGlass className="search-icon" size={18} weight="bold" />
          <input
            id="restaurant-search"
            type="search"
            placeholder="Поиск ресторана или адреса..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Поиск ресторана"
          />
        </div>
        <div style={{ position: 'relative' }} ref={filterRef}>
          <button
            className={`btn btn-icon ${showFilters ? 'btn-primary' : 'btn-secondary'}${onlyOpen || sort !== 'default' ? ' btn-icon-active' : ''}`}
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            aria-label="Открыть фильтры"
            style={{
              height: '46px',
              width: '46px',
              padding: 0,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <Faders size={18} weight="bold" />
          </button>

          {showFilters && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                minWidth: '220px',
                boxShadow: 'var(--shadow-lg)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <label className="sort-chip sort-chip-checkbox">
                <input
                  type="checkbox"
                  checked={onlyOpen}
                  onChange={() => setOnlyOpen((value) => !value)}
                />
                Открыто
              </label>
              <div className="home-sort-panel">
                <button
                  type="button"
                  className={`sort-chip${sort === 'default' ? ' active' : ''}`}
                  onClick={() => {
                    if (sort === 'default') return;
                    setSort('default');
                  }}
                >
                  По умолчанию
                </button>
                <button
                  type="button"
                  className={`sort-chip${sort === 'rating' ? ' active' : ''}`}
                  onClick={() => {
                    if (sort === 'rating') {
                      setDirection((value) =>
                        value === 'desc' ? 'asc' : 'desc'
                      );
                    } else {
                      setSort('rating');
                    }
                  }}
                >
                  <Star size={14} weight="fill" />
                  Оценка
                  {sort === 'rating' && (
                    <span className="sort-direction-icon">
                      {direction === 'desc' ? (
                        <SortDescending size={14} weight="bold" />
                      ) : (
                        <SortAscending size={14} weight="bold" />
                      )}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`sort-chip${sort === 'popularity_7d' ? ' active' : ''}`}
                  onClick={() => {
                    if (sort === 'popularity_7d') {
                      setDirection((value) =>
                        value === 'desc' ? 'asc' : 'desc'
                      );
                    } else {
                      setSort('popularity_7d');
                    }
                  }}
                >
                  <ChartBar size={14} weight="bold" />
                  Популярность
                  {sort === 'popularity_7d' && (
                    <span className="sort-direction-icon">
                      {direction === 'desc' ? (
                        <SortDescending size={14} weight="bold" />
                      ) : (
                        <SortAscending size={14} weight="bold" />
                      )}
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="restaurants-section">
        <div className="section-header">
          <Storefront size={20} weight="bold" color="var(--fire)" />
          <h1 className="section-title">Все заведения</h1>
          <span
            className="text-muted"
            style={{ fontSize: '0.8rem', fontWeight: 600 }}
          >
            {publicRestaurants.length}
          </span>
        </div>

        {loading && publicRestaurants.length === 0 ? (
          <div className="restaurants-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="restaurant-card-skeleton" />
            ))}
          </div>
        ) : publicRestaurants.length === 0 ? (
          <EmptyState
            title="Ничего не найдено"
            subtitle="Попробуйте другой поиск или фильтр"
            action={{
              label: 'Сбросить',
              onClick: () => {
                setSearch('');
                setOnlyOpen(false);
              },
            }}
          />
        ) : (
          <div>
            <div
              className={`restaurants-grid${loading ? ' restaurants-grid--loading' : ''}`}
            >
              {publicRestaurants.map((r, i) => (
                <div
                  key={r.id}
                  className="restaurant-card-fade"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <RestaurantCard
                    restaurant={r}
                    onClick={() => handleCardClick(r)}
                  />
                </div>
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={Math.ceil((publicRestaurantsTotal || 1) / size)}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
