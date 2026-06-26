import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  BowlFood,
  Clock,
  Minus,
  Plus,
  X,
  Fire,
  Hamburger,
  Pizza,
  Leaf,
  Cookie,
  Coffee,
  DotsThree,
} from "@phosphor-icons/react";

const CATEGORY_ICONS = {
  SHAURMA: <Fire size={52} />,
  BURGER: <Hamburger size={52} />,
  PIZZA: <Pizza size={52} />,
  SUSHI: <BowlFood size={52} />,
  SALAD: <Leaf size={52} />,
  SNACK: <Cookie size={52} />,
  DRINK: <Coffee size={52} />,
  OTHER: <DotsThree size={52} />,
  DEFAULT: <BowlFood size={52} />,
};

const formatPrice = (value) => `${value} ₽`;

const getActiveOptionGroups = (item) =>
  (item?.option_groups || [])
    .filter((group) => group.is_active !== false)
    .map((group) => ({
      ...group,
      options: (group.options || []).filter(
        (option) => option.is_available !== false,
      ),
    }))
    .filter((group) => group.options.length > 0);

const getSelectedOptions = (groups, ids) => {
  const idsSet = new Set(ids);
  return groups
    .flatMap((group) => group.options)
    .filter((option) => idsSet.has(option.id));
};

const getMinSelected = (group) =>
  group.is_required
    ? Math.max(1, Number(group.min_selected) || 0)
    : Number(group.min_selected) || 0;

const getGroupHint = (group) => {
  const min = getMinSelected(group);
  const max = group.selection_type === "single" ? 1 : group.max_selected;

  if (group.selection_type === "single") {
    return group.is_required ? "Обязательно выбрать 1" : "Можно выбрать 1";
  }

  if (group.is_required && max) {
    return min === max ? `Выберите ${min}` : `Выберите от ${min} до ${max}`;
  }

  if (group.is_required) return `Выберите минимум ${min}`;
  if (max) return `Можно выбрать до ${max}`;
  return "Можно выбрать несколько";
};

const ProductSheet = ({ item, onClose, onAdd, isRestaurantOpen = true }) => {
  const [selectedOptionIds, setSelectedOptionIds] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const groups = useMemo(() => getActiveOptionGroups(item), [item]);
  const isClosed = isRestaurantOpen === false;
  const icon =
    CATEGORY_ICONS[item?.category?.toUpperCase()] || CATEGORY_ICONS.DEFAULT;

  useEffect(() => {
    if (!item) return;
    setSelectedOptionIds(
      groups.flatMap((group) =>
        group.is_required && group.selection_type === "single"
          ? [group.options[0].id]
          : [],
      ),
    );
    setQuantity(1);
    setError("");
  }, [item, groups]);

  if (!item) return null;

  const selectedOptions = getSelectedOptions(groups, selectedOptionIds);
  const unitPrice =
    (Number(item.price) || 0) +
    selectedOptions.reduce(
      (sum, option) => sum + (Number(option.price_delta) || 0),
      0,
    );

  const toggleOption = (group, option) => {
    setError("");
    setSelectedOptionIds((current) => {
      const groupOptionIds = group.options.map((entry) => entry.id);
      const hasOption = current.includes(option.id);
      if (group.selection_type === "single") {
        return [
          ...current.filter((id) => !groupOptionIds.includes(id)),
          option.id,
        ];
      }
      if (hasOption) return current.filter((id) => id !== option.id);
      if (group.max_selected) {
        const selectedInGroup = current.filter((id) =>
          groupOptionIds.includes(id),
        );
        if (selectedInGroup.length >= group.max_selected) return current;
      }
      return [...current, option.id];
    });
  };

  const handleAdd = () => {
    if (isClosed) {
      setError("Заведение сейчас закрыто и не принимает заказы");
      return;
    }

    for (const group of groups) {
      const groupOptionIds = group.options.map((option) => option.id);
      const selectedCount = selectedOptionIds.filter((optionId) =>
        groupOptionIds.includes(optionId),
      ).length;
      if (selectedCount < getMinSelected(group)) {
        setError(`Выберите: ${group.name}`);
        return;
      }
    }
    onAdd?.({ item, selectedOptions, quantity });
  };

  const sheet = (
    <div
      className="product-sheet-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <section
        className={`product-sheet${groups.length === 0 ? " product-sheet--compact" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <button
          className="product-sheet-close"
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <X size={18} weight="bold" />
        </button>
        <div className="product-sheet-media">
          {item.photo_url ? (
            <img src={item.photo_url} alt={item.name} />
          ) : (
            <div className="product-sheet-placeholder">{icon}</div>
          )}
        </div>
        <div className="product-sheet-body">
          <div className="product-sheet-head">
            <div>
              <h2>{item.name}</h2>
              {item.description && <p>{item.description}</p>}
            </div>
          </div>
          <div className="product-sheet-price-row">
            <div className="product-sheet-base-price">
              {formatPrice(item.price)}
            </div>
            <div className="product-sheet-meta">
              <span>
                <Clock size={14} weight="bold" />~{item.prep_time_minutes || 15}{" "}
                мин
              </span>
            </div>
          </div>
          {groups.length > 0 && (
            <div className="product-options">
              {groups.map((group) => {
                const groupOptionIds = group.options.map((option) => option.id);
                const selectedCount = selectedOptionIds.filter((optionId) =>
                  groupOptionIds.includes(optionId),
                ).length;
                return (
                  <div key={group.id} className="product-option-group">
                    <div className="product-option-group-head">
                      <strong>{group.name}</strong>
                      <span>{getGroupHint(group)}</span>
                    </div>
                    <div className="product-option-list">
                      {group.options.map((option) => {
                        const checked = selectedOptionIds.includes(option.id);
                        const disabled =
                          !checked &&
                          group.selection_type !== "single" &&
                          group.max_selected &&
                          selectedCount >= group.max_selected;
                        return (
                          <label
                            key={option.id}
                            className={`product-option${checked ? " is-selected" : ""}`}
                          >
                            <span>
                              <input
                                type={
                                  group.selection_type === "single"
                                    ? "radio"
                                    : "checkbox"
                                }
                                name={`option-group-${group.id}`}
                                checked={checked}
                                disabled={Boolean(disabled)}
                                onChange={() => toggleOption(group, option)}
                              />
                              {option.name}
                            </span>
                            {option.price_delta > 0 && (
                              <em>+{formatPrice(option.price_delta)}</em>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && <div className="form-error">{error}</div>}
        </div>
        <div className="product-sheet-footer">
          <div className="product-qty">
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              aria-label="Уменьшить количество"
            >
              <Minus size={16} weight="bold" />
            </button>
            <span>{quantity}</span>
            <button
              type="button"
              onClick={() => setQuantity((value) => Math.min(99, value + 1))}
              aria-label="Увеличить количество"
            >
              <Plus size={16} weight="bold" />
            </button>
          </div>
          <button className="btn btn-primary product-add" onClick={handleAdd}>
            {isClosed
              ? "Заведение закрыто"
              : `Добавить · ${formatPrice(unitPrice * quantity)}`}
          </button>
        </div>
      </section>
    </div>
  );

  return createPortal(sheet, document.body);
};

export default ProductSheet;
