import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useOrderStore } from "../store/useOrderStore";
import { useShallow } from "zustand/react/shallow";

const CartDrawer = ({ onClose }) => {
  const navigate = useNavigate();
  const {
    cart,
    addToCart,
    removeFromCart,
    cartTotal,
    cartCount,
    placeOrder,
    cartRestaurantId,
  } = useOrderStore(
    useShallow((s) => ({
      cart: s.cart,
      addToCart: s.addToCart,
      removeFromCart: s.removeFromCart,
      clearCart: s.clearCart,
      cartTotal: s.cartTotal,
      cartCount: s.cartCount,
      placeOrder: s.placeOrder,
      cartRestaurantId: s.cartRestaurantId,
    })),
  );
  const [comment, setComment] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");

  const total = cartTotal ? cartTotal() : 0;
  const count = cartCount ? cartCount() : 0;

  const handlePlaceOrder = async () => {
    setPlacing(true);
    setError("");
    try {
      const order = await placeOrder(promoCode || null, comment);
      onClose();
      navigate(`/orders/${order.id}`);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(
        typeof detail === "string" ? detail : "Ошибка при оформлении заказа",
      );
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 200 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--bg-card, #fff)",
          borderRadius: "16px 16px 0 0",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "16px 16px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <span style={{ fontWeight: 800, fontSize: "1rem" }}>
            🛒 Корзина · {count} поз.
          </span>
          <button
            style={{
              background: "none",
              border: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "var(--text-3)",
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div style={{ overflowY: "auto", flex: 1, padding: "12px 16px" }}>
          {cart.map((item) => {
            const optionIds = item.selectedOptionIds ?? [];
            const optionsTotal = (item.selectedOptions ?? []).reduce(
              (s, o) => s + (Number(o.price_delta) || 0),
              0,
            );
            const linePrice = (Number(item.menuItem.price) || 0) + optionsTotal;
            return (
              <div
                key={item.lineKey ?? item.menuItem.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 0",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.88rem",
                      color: "var(--text-1)",
                    }}
                  >
                    {item.menuItem.name}
                  </div>
                  {item.selectedOptions?.length > 0 && (
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-3)",
                        marginTop: 2,
                      }}
                    >
                      {item.selectedOptions.map((o) => o.name).join(", ")}
                    </div>
                  )}
                  <div
                    style={{
                      fontWeight: 800,
                      color: "var(--fire, #e85d04)",
                      fontSize: "0.85rem",
                      marginTop: 2,
                    }}
                  >
                    {linePrice} ₽
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--bg-surface)",
                      border: "1px solid var(--border)",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                    onClick={() => removeFromCart(item.menuItem.id, optionIds)}
                  >
                    −
                  </button>
                  <span
                    style={{
                      fontWeight: 700,
                      minWidth: 20,
                      textAlign: "center",
                    }}
                  >
                    {item.quantity}
                  </span>
                  <button
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: "var(--fire, #e85d04)",
                      border: "none",
                      color: "#fff",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontSize: "1rem",
                    }}
                    onClick={() =>
                      addToCart(
                        item.menuItem,
                        cartRestaurantId,
                        item.selectedOptions ?? [],
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}

          <div
            style={{
              marginTop: 14,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <input
              className="form-input"
              placeholder="Промокод (если есть)"
              value={promoCode}
              onChange={(e) => setPromoCode(e.target.value)}
              style={{ fontSize: "0.88rem" }}
            />
            <textarea
              className="form-input"
              placeholder="Комментарий к заказу..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              style={{ fontSize: "0.88rem", resize: "none" }}
            />
          </div>
        </div>

        <div
          style={{ padding: "12px 16px", borderTop: "1px solid var(--border)" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 12,
              fontWeight: 800,
              fontSize: "1rem",
            }}
          >
            <span>Итого</span>
            <span style={{ color: "var(--fire, #e85d04)" }}>{total} ₽</span>
          </div>
          {error && (
            <div className="form-error" style={{ marginBottom: 10 }}>
              {error}
            </div>
          )}
          <button
            className="btn btn-primary btn-full"
            style={{
              height: 50,
              fontSize: "1rem",
              fontWeight: 800,
              borderRadius: "var(--r-md, 12px)",
            }}
            onClick={handlePlaceOrder}
            disabled={placing}
          >
            {placing ? "Оформляем..." : `Заказать за ${total} ₽`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CartDrawer;
