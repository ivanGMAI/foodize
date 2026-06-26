import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  MagnifyingGlass,
  SortAscending,
  SortDescending,
  Star,
  ChartBar,
} from "@phosphor-icons/react";
import { useRestaurantStore } from "../../store/useRestaurantStore";
import { useShallow } from "zustand/react/shallow";
import RestaurantCard from "../../components/ui/RestaurantCard";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";

const HomePage = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [sort, setSort] = useState("default");
  const [direction, setDirection] = useState("desc");
  const [page, setPage] = useState(1);
  const size = 20;

  const {
    publicRestaurants,
    loading,
    publicRestaurantsTotal,
    fetchPublicRestaurants,
  } = useRestaurantStore(
    useShallow((s) => ({
      publicRestaurants: s.publicRestaurants,
      loading: s.loading,
      publicRestaurantsTotal: s.publicRestaurantsTotal,
      fetchPublicRestaurants: s.fetchPublicRestaurants,
    })),
  );
  const totalPages = Math.ceil(publicRestaurantsTotal / size) || 1;

  const load = useCallback(() => {
    fetchPublicRestaurants({
      name: search || undefined,
      is_open: onlyOpen ? true : undefined,
      sort,
      direction,
      page,
      size,
    });
  }, [search, onlyOpen, sort, direction, page, fetchPublicRestaurants]);

  useEffect(() => {
    const timer = setTimeout(load, 350);
    return () => clearTimeout(timer);
  }, [load]);

  return (
    <div className="home-page">
      <div className="search-bar-wrap">
        <div className="search-bar">
          <MagnifyingGlass size={18} className="search-icon" />
          <input
            type="search"
            placeholder="Поиск ресторана..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 10,
            fontSize: "0.85rem",
            color: "var(--text-2)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={onlyOpen}
            onChange={(e) => {
              setOnlyOpen(e.target.checked);
              setPage(1);
            }}
          />
          Только открытые
        </label>
        <div className="home-sort-panel">
          <button
            type="button"
            className={`sort-chip${sort === "default" ? " active" : ""}`}
            onClick={() => {
              setSort("default");
              setPage(1);
            }}
          >
            По умолчанию
          </button>
          <button
            type="button"
            className={`sort-chip${sort === "rating" ? " active" : ""}`}
            onClick={() => {
              setSort("rating");
              setPage(1);
            }}
          >
            <Star size={14} weight="fill" /> Оценка
          </button>
          <button
            type="button"
            className={`sort-chip${sort === "popularity_7d" ? " active" : ""}`}
            onClick={() => {
              setSort("popularity_7d");
              setPage(1);
            }}
          >
            <ChartBar size={14} weight="bold" /> Популярность
          </button>
          {sort !== "default" && (
            <button
              type="button"
              className="sort-chip sort-chip-icon"
              onClick={() => {
                setDirection((value) => (value === "desc" ? "asc" : "desc"));
                setPage(1);
              }}
              aria-label="Изменить направление сортировки"
            >
              {direction === "desc" ? (
                <SortDescending size={16} weight="bold" />
              ) : (
                <SortAscending size={16} weight="bold" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="restaurants-section">
        <div className="section-header">
          <h1 className="section-title">Заведения</h1>
          {publicRestaurantsTotal > 0 && (
            <span
              style={{
                fontSize: "0.85rem",
                color: "var(--text-3)",
                fontWeight: 600,
              }}
            >
              {publicRestaurantsTotal}
            </span>
          )}
        </div>

        {loading && publicRestaurants.length === 0 ? (
          <div className="loading-center">
            <div className="spinner" />
          </div>
        ) : publicRestaurants.length === 0 ? (
          <EmptyState
            title="Ничего не найдено"
            subtitle="Попробуйте другой поиск или уберите фильтры"
          />
        ) : (
          <div className={loading ? "loading-dim" : undefined}>
            <div className="restaurants-grid">
              {publicRestaurants.map((r) => (
                <RestaurantCard
                  key={r.id}
                  restaurant={r}
                  onClick={() =>
                    navigate(`/restaurant/${r.display_id || r.id}`, {
                      state: { restaurant: r },
                    })
                  }
                />
              ))}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;
