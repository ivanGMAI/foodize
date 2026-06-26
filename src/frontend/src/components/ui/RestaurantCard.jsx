import { useRef, useEffect } from 'react';
import {
  Fire,
  Hamburger,
  Pizza,
  BowlFood,
  Storefront,
  MapPin,
  Star,
} from '@phosphor-icons/react';

const CATEGORY_ICONS = {
  SHAURMA: <Fire size={52} weight="fill" />,
  BURGER: <Hamburger size={52} weight="fill" />,
  PIZZA: <Pizza size={52} weight="fill" />,
  SUSHI: <BowlFood size={52} weight="fill" />,
  DEFAULT: <Storefront size={52} weight="fill" />,
};

const RestaurantCard = ({ restaurant, onClick }) => {
  const cardRef = useRef(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const icon =
    CATEGORY_ICONS[restaurant.category?.toUpperCase()] ||
    CATEGORY_ICONS.DEFAULT;
  const rating = restaurant.average_rating;

  return (
    <div
      ref={cardRef}
      className="restaurant-card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick?.()}
      aria-label={`Ресторан ${restaurant.name}`}
    >
      <div className="card-photo-wrap">
        {restaurant.photo_url ? (
          <img
            className="card-photo"
            src={restaurant.photo_url}
            alt={restaurant.name}
            loading="lazy"
            style={{ viewTransitionName: `restaurant-image-${restaurant.id}` }}
          />
        ) : (
          <div className="card-photo-placeholder">{icon}</div>
        )}
      </div>

      <div className="card-scrim" />

      {restaurant.is_open != null && (
        <div
          className={`card-status-badge card-status-badge--${restaurant.is_open ? 'open' : 'closed'}`}
        >
          <span className="card-status-dot" />
          <span className="card-status-label">
            {restaurant.is_open ? 'Открыто' : 'Закрыто'}
          </span>
        </div>
      )}

      <div className="card-rating-badge">
        <Star size={13} weight="fill" color="var(--fire)" />
        <span>{rating ? rating.toFixed(1) : '0.0'}</span>
      </div>

      <div className="card-body">
        <h2 className="card-title">{restaurant.name}</h2>
        <div className="card-tags card-reveal">
          <span className="tag-pill">
            <MapPin size={12} weight="bold" />
            {restaurant.address}
          </span>
          {restaurant.category && (
            <span className="tag-pill">{restaurant.category}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default RestaurantCard;
