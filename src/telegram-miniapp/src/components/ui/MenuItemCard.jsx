import {
  Fire,
  Hamburger,
  Pizza,
  BowlFood,
  CookingPot,
  Clock,
  Leaf,
  Cookie,
  Coffee,
  DotsThree,
  ProhibitInset,
} from "@phosphor-icons/react";

const CATEGORY_ICONS = {
  SHAURMA: <Fire size={36} />,
  BURGER: <Hamburger size={36} />,
  PIZZA: <Pizza size={36} />,
  SUSHI: <BowlFood size={36} />,
  SALAD: <Leaf size={36} />,
  SNACK: <Cookie size={36} />,
  DRINK: <Coffee size={36} />,
  OTHER: <DotsThree size={36} />,
  DEFAULT: <CookingPot size={36} />,
};

const formatPrice = (value) => `${value} ₽`;

const MenuItemCard = ({ item, onSelect, isRestaurantOpen = true }) => {
  const icon =
    CATEGORY_ICONS[item.category?.toUpperCase()] || CATEGORY_ICONS.DEFAULT;
  const isClosed = isRestaurantOpen === false;
  const unavailable = item.is_available === false || isClosed;
  const optionGroups = (item.option_groups || []).filter(
    (group) => group.is_active !== false && (group.options || []).length > 0,
  );

  return (
    <button
      type="button"
      className="menu-item"
      style={unavailable ? { opacity: 0.45, filter: "grayscale(0.6)" } : {}}
      onClick={() => !unavailable && onSelect?.(item)}
      disabled={unavailable}
      aria-label={`Открыть ${item.name}`}
    >
      <div className="menu-item-img" style={{ minHeight: "90px" }}>
        {item.photo_url ? (
          <img src={item.photo_url} alt={item.name} loading="lazy" />
        ) : (
          <div className="menu-item-img-placeholder">{icon}</div>
        )}
        {unavailable && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.45)",
              borderRadius: "inherit",
            }}
          >
            <ProhibitInset
              size={28}
              color="rgba(255,255,255,0.7)"
              weight="bold"
            />
          </div>
        )}
      </div>

      <div className="menu-item-info">
        <div className="menu-item-name">{item.name}</div>
        {item.description && (
          <div className="menu-item-desc">{item.description}</div>
        )}
        <div className="menu-item-footer">
          <span className="menu-item-price">{formatPrice(item.price)}</span>
          {unavailable ? (
            <span className="tag-pill">
              {isClosed ? "Закрыто" : "Недоступно"}
            </span>
          ) : (
            <span className="tag-pill">
              <Clock size={11} />~{item.prep_time_minutes || 15} мин
            </span>
          )}
        </div>
      </div>

      <div className="menu-item-side">
        {!unavailable && optionGroups.length > 0 && (
          <span className="menu-item-options-hint">Допы</span>
        )}
        {!unavailable && (
          <span className="menu-item-choose" aria-hidden="true">
            +
          </span>
        )}
      </div>
    </button>
  );
};

export default MenuItemCard;
