import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import {
  Heart,
  Star,
  ShoppingCart,
  ChatCircle,
  Pizza,
  Hamburger,
  BowlFood,
  Leaf,
  Cookie,
  Coffee,
  DotsThree,
  List,
  Fire,
  Trash,
  MapPin,
} from "@phosphor-icons/react";
import { useRestaurantStore } from "../../store/useRestaurantStore";
import { useOrderStore } from "../../store/useOrderStore";
import { useFavoriteStore } from "../../store/useFavoriteStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useShallow } from "zustand/react/shallow";
import { reviewService } from "../../services/reviewService";
import { restaurantService } from "../../services/restaurantService";
import { translateApiError } from "../../utils/translateApiError";
import { BackButton } from "../../telegram/sdk";
import MenuItemCard from "../../components/ui/MenuItemCard";
import ProductSheet from "../../components/ui/ProductSheet";
import CartDrawer from "../../components/ui/CartDrawer";

const Portal = ({ children }) =>
  typeof document === "undefined"
    ? null
    : createPortal(children, document.body);

const CATEGORY_ICONS = {
  SHAURMA: <Fire size={14} />,
  BURGER: <Hamburger size={14} />,
  PIZZA: <Pizza size={14} />,
  SUSHI: <BowlFood size={14} />,
  SALAD: <Leaf size={14} />,
  SNACK: <Cookie size={14} />,
  DRINK: <Coffee size={14} />,
  OTHER: <DotsThree size={14} />,
};

const formatReviewTime = (value) => {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "";
  }
};

const RestaurantPage = () => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [restaurantData, setRestaurantData] = useState(
    location.state?.restaurant ?? null,
  );
  const [rating, setRating] = useState(null);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [showReviews, setShowReviews] = useState(false);
  const [reviewsList, setReviewsList] = useState([]);
  const [reviewForm, setReviewForm] = useState({ rating: 5, text: "" });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const currentUser = useAuthStore((s) => s.user);
  const [reviewDeleteId, setReviewDeleteId] = useState(null);
  const [workingHours, setWorkingHours] = useState([]);
  const [showInfo, setShowInfo] = useState(false);

  const { fetchMenu, menus, loading } = useRestaurantStore(
    useShallow((s) => ({
      fetchMenu: s.fetchMenu,
      menus: s.menus,
      loading: s.loading,
    })),
  );
  const { addToCart, cartCount } = useOrderStore(
    useShallow((s) => ({
      addToCart: s.addToCart,
      cartCount: s.cartCount,
    })),
  );
  const { favoriteIds, toggle } = useFavoriteStore(
    useShallow((s) => ({
      favoriteIds: s.favoriteIds,
      toggle: s.toggle,
    })),
  );

  const restaurant = restaurantData ?? { id, name: "Ресторан", address: "" };
  const menuItems = menus[id] || [];
  const isFav = favoriteIds.has(id);
  const count = cartCount ? cartCount() : 0;
  const isRestaurantOpen = restaurant.is_open !== false;

  useEffect(() => {
    if (BackButton) {
      BackButton.show();
      const handler = () => navigate("/");
      BackButton.onClick(handler);
      return () => {
        BackButton.offClick(handler);
        BackButton.hide();
      };
    }
  }, [navigate]);

  useEffect(() => {
    fetchMenu(id);
    if (!location.state?.restaurant) {
      restaurantService
        .getById(id)
        .then((res) => setRestaurantData(res.data.data))
        .catch(() => {});
    }
    reviewService
      .getRating(id)
      .then((res) => {
        const val =
          res.data?.data?.average_rating ?? res.data?.data?.rating ?? null;
        setRating(val);
      })
      .catch(() => {});

    restaurantService
      .getWorkingHours(id)
      .then((res) => {
        setWorkingHours(res.data?.data || []);
      })
      .catch(() => {});
  }, [id, fetchMenu, location.state]);

  const loadReviews = () => {
    setReviewsLoading(true);
    reviewService
      .getReviews(id)
      .then((res) =>
        setReviewsList(Array.isArray(res.data?.data) ? res.data.data : []),
      )
      .finally(() => setReviewsLoading(false));
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError("");
    const text = reviewForm.text.trim();
    if (!text) {
      setReviewError("Напишите текст");
      return;
    }
    setReviewSubmitting(true);
    const payload = {
      text,
      rating: reviewForm.rating,
    };
    try {
      let res;
      try {
        res = await reviewService.createReview(id, payload);
      } catch (err) {
        const detail = err?.response?.data?.detail;
        if (
          err?.response?.status === 409 ||
          detail === "You have already reviewed this restaurant"
        ) {
          res = await reviewService.updateMyReview(id, payload);
        } else {
          throw err;
        }
      }
      const savedReview = res?.data?.data;
      setReviewSuccess(true);
      setReviewForm({ rating: 5, text: "" });
      window.setTimeout(() => setReviewSuccess(false), 2200);
      if (savedReview?.id) {
        setReviewsList((prev) => [
          savedReview,
          ...prev.filter((review) => review.id !== savedReview.id),
        ]);
      } else {
        loadReviews();
      }
      reviewService
        .getRating(id)
        .then((ratingRes) => {
          const val =
            ratingRes.data?.data?.average_rating ??
            ratingRes.data?.data?.rating ??
            null;
          setRating(val);
        })
        .catch(() => {});
    } catch (err) {
      setReviewError(translateApiError(err, "Не удалось отправить отзыв"));
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleReviewDelete = async (reviewId) => {
    setReviewDeleteId(reviewId);
  };

  const confirmReviewDelete = async () => {
    if (!reviewDeleteId) return;
    setReviewError("");
    try {
      await reviewService.deleteReview(id, reviewDeleteId);
      setReviewsList((prev) =>
        prev.filter((review) => review.id !== reviewDeleteId),
      );
      setReviewDeleteId(null);
      reviewService
        .getRating(id)
        .then((res) => {
          const val =
            res.data?.data?.average_rating ?? res.data?.data?.rating ?? null;
          setRating(val);
        })
        .catch(() => {});
    } catch {
      setReviewError("Не удалось удалить отзыв");
    }
  };

  const allItems = menuItems.filter((i) => i.is_available !== false);
  const categories = [
    "ALL",
    ...new Set(allItems.map((i) => i.category).filter(Boolean)),
  ];
  const filtered =
    activeCategory === "ALL"
      ? allItems
      : allItems.filter((i) => i.category === activeCategory);

  const openProduct = (item) => {
    if (!isRestaurantOpen) return;
    setSelectedProduct(item);
  };

  const handleProductAdd = ({ item, selectedOptions, quantity }) => {
    if (!isRestaurantOpen) return;
    addToCart(item, id, selectedOptions, quantity);
    setSelectedProduct(null);
  };

  return (
    <div style={{ minHeight: "100vh", paddingBottom: count > 0 ? 80 : 20 }}>
      <div className="restaurant-hero">
        {restaurant.photo_url ? (
          <img
            className="restaurant-hero-img"
            src={restaurant.photo_url}
            alt={restaurant.name}
          />
        ) : (
          <div className="restaurant-hero-placeholder">🍽️</div>
        )}
        <div className="restaurant-hero-overlay" />
        <div className="restaurant-hero-info">
          <div className="restaurant-hero-name">{restaurant.name}</div>
          {restaurant.address && (
            <div
              style={{
                fontSize: "0.78rem",
                color: "rgba(255,255,255,0.75)",
                marginBottom: 6,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <MapPin size={12} weight="bold" />
              {restaurant.address}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {rating != null && (
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  color: "var(--amber)",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                }}
              >
                <Star size={14} weight="fill" />
                {Number(rating).toFixed(1)}
              </span>
            )}
            <button
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#fff",
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: "0.78rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
              onClick={() => {
                setShowReviews(true);
                loadReviews();
              }}
            >
              <ChatCircle size={14} style={{ marginRight: 4 }} />
              Отзывы
            </button>
            <button
              style={{
                background: "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#fff",
                borderRadius: 20,
                padding: "4px 12px",
                fontSize: "0.78rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
              }}
              onClick={() => setShowInfo(true)}
            >
              Инфо
            </button>
          </div>
        </div>
        <button
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: isFav ? "rgba(239,68,68,0.18)" : "rgba(0,0,0,0.4)",
            border: isFav
              ? "1px solid rgba(239,68,68,0.4)"
              : "1px solid rgba(255,255,255,0.15)",
            borderRadius: "var(--r-xs)",
            width: 36,
            height: 36,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
          onClick={() => toggle(id)}
          aria-label={isFav ? "Убрать из избранного" : "В избранное"}
        >
          <Heart
            size={16}
            weight={isFav ? "fill" : "regular"}
            color={isFav ? "#ef4444" : "rgba(255,255,255,0.8)"}
          />
        </button>
      </div>

      <div className="restaurant-content">
        {!isRestaurantOpen && (
          <div
            style={{
              padding: "12px 14px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.35)",
              borderRadius: "var(--r-md)",
              color: "#ef4444",
              fontSize: "0.84rem",
              fontWeight: 800,
              marginBottom: 14,
            }}
          >
            Заведение сейчас закрыто и не принимает заказы
          </div>
        )}
        <div className="menu-categories-scroll">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`category-chip${activeCategory === cat ? " active" : ""}`}
              onClick={() => setActiveCategory(cat)}
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              {cat === "ALL" ? <List size={14} /> : CATEGORY_ICONS[cat]}
              {cat === "ALL" ? "Все" : cat}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="menu-list">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="menu-item"
                style={{ pointerEvents: "none" }}
              >
                <div
                  className="menu-item-img skeleton"
                  style={{ minHeight: 90, borderRadius: "var(--r-sm)" }}
                />
                <div
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div
                    className="skeleton"
                    style={{ width: "65%", height: 14 }}
                  />
                  <div
                    className="skeleton"
                    style={{ width: "85%", height: 11 }}
                  />
                  <div
                    className="skeleton"
                    style={{ width: "35%", height: 14, marginTop: 4 }}
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
                onSelect={openProduct}
                isRestaurantOpen={isRestaurantOpen}
              />
            ))}
          </div>
        )}
      </div>

      {count > 0 && !showCart && (
        <Portal>
          <button className="cart-fab" onClick={() => setShowCart(true)}>
            <ShoppingCart size={20} weight="bold" />
            <span className="cart-fab-label">Корзина</span>
            <span className="cart-badge">{count}</span>
          </button>
        </Portal>
      )}

      {showCart && (
        <Portal>
          <CartDrawer
            onClose={() => setShowCart(false)}
            isRestaurantOpen={isRestaurantOpen}
          />
        </Portal>
      )}

      {selectedProduct && (
        <ProductSheet
          item={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAdd={handleProductAdd}
          isRestaurantOpen={isRestaurantOpen}
        />
      )}

      {reviewDeleteId && (
        <Portal>
          <div
            className="modal-overlay restaurant-modal-overlay"
            style={{ zIndex: 5000 }}
          >
            <div
              className="modal-content review-delete-modal"
              style={{
                padding: 20,
                borderRadius: 14,
                maxWidth: 360,
              }}
            >
              <h3 style={{ margin: 0, fontSize: "1rem" }}>Удалить отзыв?</h3>
              <p
                style={{
                  color: "var(--text-3)",
                  fontSize: "0.88rem",
                  lineHeight: 1.45,
                  margin: "10px 0 18px",
                }}
              >
                Точно ли вы хотите удалить этот отзыв?
              </p>
              <div
                style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setReviewDeleteId(null)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmReviewDelete}
                  style={{ background: "#ef4444" }}
                >
                  Удалить
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {showReviews && (
        <Portal>
          <div
            className="modal-overlay restaurant-modal-overlay"
            style={{ zIndex: 3000 }}
          >
            <div
              className="modal-content reviews-modal"
              style={{
                maxWidth: 500,
                maxHeight: "calc(var(--tg-viewport-h, 100dvh) - 24px)",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>
                  Отзывы
                </span>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    fontSize: 20,
                    cursor: "pointer",
                  }}
                  onClick={() => setShowReviews(false)}
                >
                  ✕
                </button>
              </div>
              <div
                className="reviews-modal-scroll"
                style={{ overflowY: "auto", flex: 1, minHeight: 0 }}
              >
                {reviewSuccess && (
                  <div
                    style={{
                      position: "absolute",
                      top: 14,
                      left: "50%",
                      transform: "translateX(-50%)",
                      zIndex: 2,
                      padding: "9px 12px",
                      borderRadius: 8,
                      background: "#16a34a",
                      color: "#fff",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      boxShadow: "0 12px 30px rgba(0,0,0,0.24)",
                    }}
                  >
                    Отзыв успешно опубликован
                  </div>
                )}
                <form
                  onSubmit={handleReviewSubmit}
                  style={{
                    background: "var(--bg-surface)",
                    padding: 16,
                    borderRadius: 10,
                    marginBottom: 16,
                    border: "1px solid var(--border)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      justifyContent: "center",
                      marginBottom: 10,
                    }}
                  >
                    {[1, 2, 3, 4, 5].map((s) => (
                      <span
                        key={s}
                        style={{ cursor: "pointer" }}
                        onClick={() =>
                          setReviewForm({ ...reviewForm, rating: s })
                        }
                      >
                        <Star
                          size={24}
                          weight={s <= reviewForm.rating ? "fill" : "regular"}
                          color={
                            s <= reviewForm.rating
                              ? "var(--amber)"
                              : "var(--border-mid)"
                          }
                        />
                      </span>
                    ))}
                  </div>
                  <textarea
                    className="form-input"
                    placeholder="Ваш отзыв..."
                    value={reviewForm.text}
                    onChange={(e) =>
                      setReviewForm({ ...reviewForm, text: e.target.value })
                    }
                    style={{ minHeight: 70, marginBottom: 8 }}
                  />
                  {reviewError && (
                    <div className="form-error" style={{ marginBottom: 8 }}>
                      {reviewError}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary btn-full"
                    disabled={reviewSubmitting}
                    style={{ borderRadius: 8 }}
                  >
                    {reviewSubmitting ? "Публикуем..." : "Опубликовать"}
                  </button>
                </form>
                {reviewsLoading ? (
                  <div className="loading-center">
                    <div className="spinner" />
                  </div>
                ) : reviewsList.length === 0 ? (
                  <p
                    style={{
                      textAlign: "center",
                      color: "var(--text-3)",
                      fontSize: "0.875rem",
                    }}
                  >
                    Отзывов пока нет
                  </p>
                ) : (
                  reviewsList.map((r) => (
                    <div
                      key={r.id}
                      className="review-card"
                      style={{
                        padding: 14,
                        background: "var(--bg-card)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        marginBottom: 8,
                        transition: "all var(--dur-sm)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                          {r.user_name || "Клиент"}
                          {formatReviewTime(r.created_at) && (
                            <span
                              style={{
                                display: "block",
                                color: "var(--text-3)",
                                fontSize: "0.74rem",
                                fontWeight: 600,
                                marginTop: 2,
                              }}
                            >
                              {formatReviewTime(r.created_at)}
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 2,
                          }}
                        >
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              size={12}
                              weight={s <= r.rating ? "fill" : "regular"}
                              color={
                                s <= r.rating
                                  ? "var(--amber)"
                                  : "var(--border-mid)"
                              }
                            />
                          ))}
                          {currentUser?.id === r.user_id && (
                            <button
                              type="button"
                              aria-label="Удалить отзыв"
                              onClick={() => handleReviewDelete(r.id)}
                              style={{
                                width: 26,
                                height: 26,
                                marginLeft: 6,
                                borderRadius: 8,
                                border: "1px solid var(--border)",
                                background: "var(--bg-surface)",
                                color: "var(--danger, #ef4444)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                              }}
                            >
                              <Trash size={13} weight="bold" />
                            </button>
                          )}
                        </span>
                      </div>
                      <p
                        style={{
                          color: "var(--text-2)",
                          margin: 0,
                          fontSize: "0.875rem",
                          lineHeight: 1.5,
                        }}
                      >
                        {r.text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {showInfo && (
        <Portal>
          <div
            className="modal-overlay restaurant-modal-overlay"
            style={{ zIndex: 3000 }}
            onClick={(e) => {
              if (e.target.classList.contains("modal-overlay"))
                setShowInfo(false);
            }}
          >
            <div
              className="modal-content info-modal"
              style={{ padding: "20px" }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 16,
                }}
              >
                <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800 }}>
                  Информация
                </h2>
                <button
                  onClick={() => setShowInfo(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-2)",
                  }}
                >
                  <X size={20} weight="bold" />
                </button>
              </div>

              {restaurant.description && (
                <div
                  style={{
                    marginBottom: 20,
                    fontSize: "0.9rem",
                    color: "var(--text-1)",
                    lineHeight: 1.5,
                  }}
                >
                  {restaurant.description}
                </div>
              )}

              <h3
                style={{ fontSize: "1rem", fontWeight: 700, marginBottom: 12 }}
              >
                Рабочие часы
              </h3>
              {workingHours.length > 0 ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  {workingHours.map((wh) => {
                    const days = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
                    const dayName =
                      days[wh.day_of_week] ?? days[wh.day_of_week - 1] ?? "";
                    return (
                      <div
                        key={wh.day_of_week}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.9rem",
                        }}
                      >
                        <span style={{ color: "var(--text-2)" }}>
                          {dayName}
                        </span>
                        <span style={{ fontWeight: 600 }}>
                          {wh.is_open
                            ? `${wh.opening_time.slice(0, 5)} - ${wh.closing_time.slice(0, 5)}`
                            : "Выходной"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: "0.9rem", color: "var(--text-3)" }}>
                  Не указаны
                </div>
              )}
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
};

export default RestaurantPage;
