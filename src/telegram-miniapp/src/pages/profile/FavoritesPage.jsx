import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MapPin, Briefcase } from "@phosphor-icons/react";
import { favoriteService } from "../../services/favoriteService";
import { useFavoriteStore } from "../../store/useFavoriteStore";
import { BackButton } from "../../telegram/sdk";
import EmptyState from "../../components/ui/EmptyState";

const FavoritesPage = () => {
  const navigate = useNavigate();
  const { toggle } = useFavoriteStore();
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (BackButton) {
      BackButton.show();
      const handler = () => navigate("/profile");
      BackButton.onClick(handler);
      return () => {
        BackButton.offClick(handler);
        BackButton.hide();
      };
    }
  }, [navigate]);

  const loadFavorites = () => {
    setLoading(true);
    favoriteService
      .getAll({ size: 100 })
      .then((res) =>
        setFavorites(Array.isArray(res.data?.data) ? res.data.data : []),
      )
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  const handleUnfavorite = async (restaurantId) => {
    await toggle(restaurantId);
    setFavorites((prev) =>
      prev.filter((f) => f.restaurant.id !== restaurantId),
    );
  };

  return (
    <div
      style={{ padding: "16px 16px calc(var(--bottom-tab-h, 68px) + 24px)" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <Heart size={22} weight="fill" color="#ef4444" />
        <span
          style={{
            fontWeight: 800,
            fontSize: "1.1rem",
            color: "var(--text-1)",
          }}
        >
          Избранное
        </span>
        {favorites.length > 0 && (
          <span
            style={{
              background: "rgba(239,68,68,0.12)",
              color: "#ef4444",
              borderRadius: 20,
              padding: "2px 10px",
              fontSize: "0.75rem",
              fontWeight: 800,
            }}
          >
            {favorites.length}
          </span>
        )}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
          <div className="spinner" />
        </div>
      ) : favorites.length === 0 ? (
        <EmptyState
          title="Нет избранных"
          subtitle="Нажмите ❤ на карточке ресторана"
          action={{ label: "Смотреть рестораны", onClick: () => navigate("/") }}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {favorites.map(({ id: favId, restaurant }) => (
            <div
              key={favId}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md, 12px)",
                padding: "14px 16px",
                display: "flex",
                alignItems: "center",
                gap: 12,
                cursor: "pointer",
              }}
              onClick={() =>
                navigate(
                  `/restaurant/${restaurant.display_id || restaurant.id}`,
                  {
                    state: { restaurant },
                  },
                )
              }
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: restaurant.is_open ? "#22c55e" : "#6b7280",
                  flexShrink: 0,
                  boxShadow: restaurant.is_open
                    ? "0 0 6px rgba(34,197,94,0.5)"
                    : "none",
                }}
              />

              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.92rem",
                    color: "var(--text-1)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {restaurant.name}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: "0.75rem",
                    color: "var(--text-3)",
                    marginTop: 2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  <MapPin size={11} weight="bold" />
                  <span
                    style={{ overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {restaurant.address}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 4,
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    color: restaurant.is_open ? "#22c55e" : "#9ca3af",
                  }}
                >
                  {restaurant.is_open ? "Открыто" : "Закрыто"}
                </span>
                {restaurant.is_hiring && (
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 3,
                      fontSize: "0.65rem",
                      fontWeight: 700,
                      color: "var(--amber, #f59e0b)",
                    }}
                  >
                    <Briefcase size={10} weight="fill" />
                    Вакансии
                  </span>
                )}
              </div>

              <button
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  flexShrink: 0,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnfavorite(restaurant.id);
                }}
                aria-label="Убрать из избранного"
              >
                <Heart size={16} weight="fill" color="#ef4444" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FavoritesPage;
