import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { useOrderStore } from "../../store/useOrderStore";
import { orderService } from "../../services/orderService";
import { createOrderWebSocket } from "../../services/api";
import { ORDER_STATUS_RU } from "../../utils/locales";

const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED"]);
const STATUS_FLOW = ["PENDING", "ACCEPTED", "READY", "COMPLETED"];

const STATUS_PILL = {
  PENDING: { label: "Новый", color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  ACCEPTED: { label: "Принят", color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  READY: {
    label: "Готов к выдаче",
    color: "#22c55e",
    bg: "rgba(34,197,94,0.12)",
  },
  COMPLETED: { label: "Выдан", color: "#6b7280", bg: "rgba(107,114,128,0.1)" },
  CANCELLED: { label: "Отменён", color: "#ef4444", bg: "rgba(239,68,68,0.1)" },
};

const fmtTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d)
    ? ""
    : d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
};

const useEtaText = (estimatedReadyAt, status) => {
  const compute = useCallback(() => {
    if (
      TERMINAL_STATUSES.has(status) ||
      status === "READY" ||
      !estimatedReadyAt
    )
      return "";
    const diff = Math.round((new Date(estimatedReadyAt) - Date.now()) / 60000);
    return diff > 0
      ? `Будет готов через ~${diff} мин`
      : "Задерживаемся, скоро будет";
  }, [estimatedReadyAt, status]);
  const [text, setText] = useState(compute);
  useEffect(() => {
    setText(compute());
    if (
      TERMINAL_STATUSES.has(status) ||
      status === "READY" ||
      !estimatedReadyAt
    )
      return;
    const id = setInterval(() => setText(compute()), 30_000);
    return () => clearInterval(id);
  }, [estimatedReadyAt, status, compute]);
  return text;
};

const HorizontalSteps = ({ order }) => {
  const currentIndex =
    order.status === "CANCELLED" ? -1 : STATUS_FLOW.indexOf(order.status);

  return (
    <div style={{ width: "100%", maxWidth: 380, marginTop: 24 }}>
      <div style={{ display: "flex", alignItems: "flex-start" }}>
        {STATUS_FLOW.map((status, i) => {
          const state =
            order.status === "CANCELLED"
              ? "next"
              : i < currentIndex
                ? "done"
                : i === currentIndex
                  ? "current"
                  : "next";
          const dotColor =
            state === "done"
              ? "var(--color-success)"
              : state === "current"
                ? "var(--fire)"
                : "var(--border)";
          const isActiveLine =
            i === currentIndex + 1 &&
            order.status !== "CANCELLED" &&
            order.status !== "COMPLETED";
          const lineColor =
            i <= currentIndex && order.status !== "CANCELLED"
              ? "var(--color-success)"
              : "var(--border)";

          return (
            <Fragment key={status}>
              {i > 0 && (
                <div
                  className={isActiveLine ? "order-step-line--active" : ""}
                  style={{
                    flex: 1,
                    height: 2,
                    background: isActiveLine ? undefined : lineColor,
                    marginTop: 5,
                    transition: isActiveLine ? "none" : "background 0.4s",
                  }}
                />
              )}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    background: dotColor,
                    flexShrink: 0,
                    transition: "background 0.4s",
                    boxShadow:
                      state === "done"
                        ? "0 0 0 3px var(--color-success-bg)"
                        : state === "current"
                          ? `0 0 0 3px var(--fire)33`
                          : "none",
                  }}
                />
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: state === "current" ? 800 : 500,
                    color:
                      state === "next"
                        ? "var(--text-3)"
                        : state === "current"
                          ? "var(--fire)"
                          : "var(--color-success)",
                    textAlign: "center",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                  }}
                >
                  {ORDER_STATUS_RU[status] ?? status}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
};

const OrderStatusPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { fetchOrder, currentOrder } = useOrderStore(
    useShallow((s) => ({
      fetchOrder: s.fetchOrder,
      currentOrder: s.currentOrder,
    })),
  );
  const wsRef = useRef(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showBonAppetit, setShowBonAppetit] = useState(false);

  const loadOrder = useCallback(() => fetchOrder(id), [id, fetchOrder]);

  useEffect(() => {
    loadOrder();

    wsRef.current = createOrderWebSocket(
      id,
      (data) => {
        if (data.error) return;
        useOrderStore.setState({ currentOrder: data });
      },
      () => {
        if (
          !TERMINAL_STATUSES.has(useOrderStore.getState().currentOrder?.status)
        ) {
          loadOrder();
        }
      },
    );

    return () => wsRef.current?.close();
  }, [id, loadOrder]);

  useEffect(() => {
    if (currentOrder?.status === "COMPLETED") {
      const key = `order_seen_${id}`;
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, "1");
        setShowBonAppetit(true);
      }
    }
  }, [currentOrder?.status, id]);

  const etaText = useEtaText(
    currentOrder?.estimated_ready_at,
    currentOrder?.status,
  );

  if (!currentOrder) {
    return (
      <div className="status-screen">
        <div
          className="skeleton"
          style={{ width: 60, height: 14, marginBottom: 8, borderRadius: 4 }}
        />
        <div
          className="skeleton"
          style={{ width: 120, height: 64, borderRadius: 8, marginBottom: 16 }}
        />
        <div
          className="skeleton"
          style={{ width: 280, height: 32, borderRadius: 20, marginBottom: 24 }}
        />
        <div
          style={{
            width: "100%",
            maxWidth: 380,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 20,
            marginBottom: 16,
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "9px 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <div className="skeleton" style={{ width: "58%", height: 14 }} />
              <div className="skeleton" style={{ width: "18%", height: 14 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const pill = STATUS_PILL[currentOrder.status] || STATUS_PILL.PENDING;
  const isReady = currentOrder.status === "READY";
  const isDone = TERMINAL_STATUSES.has(currentOrder.status);

  const handleComplete = async () => {
    setCompleting(true);
    setCompleteError("");
    try {
      await orderService.completeOrder(id);
      await fetchOrder(id);
    } catch {
      setCompleteError("Не удалось подтвердить получение");
    } finally {
      setCompleting(false);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await orderService.cancelOrder(id, null);
      await fetchOrder(id);
    } catch {
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div
      className={`status-screen page-enter${isReady ? " status-ready-flash" : ""}`}
    >
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            fontSize: "0.78rem",
            color: "var(--text-3)",
            fontWeight: 600,
            letterSpacing: "0.04em",
            marginBottom: 2,
          }}
        >
          № заказа
        </div>
        <div
          style={{
            fontSize: "4rem",
            fontWeight: 900,
            color: "var(--text-1)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          {currentOrder.display_id}
        </div>
      </div>

      <div
        style={{
          marginTop: 10,
          display: "inline-flex",
          alignItems: "center",
          padding: "5px 14px",
          borderRadius: 99,
          background: pill.bg,
          color: pill.color,
          fontWeight: 800,
          fontSize: "0.85rem",
          border: `1px solid ${pill.color}44`,
        }}
      >
        {pill.label}
      </div>

      {currentOrder.status === "CANCELLED" &&
        currentOrder.cancellation_reason && (
          <div
            style={{
              marginTop: 8,
              fontSize: "0.82rem",
              color: "var(--text-2)",
              textAlign: "center",
              maxWidth: 300,
            }}
          >
            {currentOrder.cancellation_reason}
          </div>
        )}

      <HorizontalSteps order={currentOrder} />

      <div style={{ marginTop: 16, textAlign: "center", minHeight: 40 }}>
        {isReady ? (
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "var(--color-success)",
            }}
          >
            Подойдите к стойке — заказ ждёт вас!
          </div>
        ) : etaText ? (
          <div
            style={{
              fontWeight: 600,
              fontSize: "0.9rem",
              color: etaText.startsWith("Задерж") ? "#f97316" : "var(--text-2)",
            }}
          >
            {etaText}
          </div>
        ) : null}
        {showBonAppetit && (
          <div
            style={{
              fontWeight: 700,
              fontSize: "0.95rem",
              color: "var(--color-success)",
              marginTop: 4,
            }}
          >
            Приятного аппетита! 🎉
          </div>
        )}
        <div
          style={{ marginTop: 4, fontSize: "0.78rem", color: "var(--text-3)" }}
        >
          Оформлен в {fmtTime(currentOrder.created_at)}
          {currentOrder.requested_pickup_at
            ? ` · к выдаче ${fmtTime(currentOrder.requested_pickup_at)}`
            : ""}
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          width: "100%",
          maxWidth: 380,
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: "18px 20px",
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: "0.72rem",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-3)",
            marginBottom: 12,
          }}
        >
          Состав заказа
        </div>

        {Array.isArray(currentOrder.items) &&
          currentOrder.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 0",
                borderBottom: "1px solid var(--border)",
                fontSize: "0.9rem",
                gap: 8,
              }}
            >
              <span
                style={{
                  fontWeight: 700,
                  color: "var(--text-3)",
                  minWidth: 28,
                }}
              >
                ×{item.quantity}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    color: "var(--text-1)",
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.menu_item_name}
                </div>
                {item.selected_options?.length > 0 && (
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: "0.72rem",
                      color: "var(--text-3)",
                      lineHeight: 1.35,
                    }}
                  >
                    {item.selected_options
                      .map(
                        (o) =>
                          `${o.name}${o.price_delta ? ` +${o.price_delta} ₽` : ""}`,
                      )
                      .join(", ")}
                  </div>
                )}
              </div>
              <span style={{ fontWeight: 700, flexShrink: 0 }}>
                {item.price_at_purchase * item.quantity} ₽
              </span>
            </div>
          ))}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 12,
            fontWeight: 800,
            fontSize: "1rem",
            letterSpacing: "-0.02em",
          }}
        >
          <span>Итого</span>
          <span style={{ color: "var(--fire)" }}>
            {currentOrder.total_price} ₽
          </span>
        </div>
      </div>

      {(currentOrder.restaurant_name || currentOrder.restaurant_address) && (
        <div
          style={{
            marginTop: 12,
            width: "100%",
            maxWidth: 380,
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: "14px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {currentOrder.restaurant_name && (
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.9rem",
                color: "var(--text-1)",
              }}
            >
              {currentOrder.restaurant_name}
            </div>
          )}
          {currentOrder.restaurant_address && (
            <div style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
              {currentOrder.restaurant_address}
            </div>
          )}
        </div>
      )}

      {completeError && (
        <div
          className="form-error"
          style={{ marginTop: 16, maxWidth: 380, width: "100%" }}
        >
          {completeError}
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: 10,
          marginTop: 16,
          width: "100%",
          maxWidth: 380,
        }}
      >
        {isReady && (
          <button
            className="btn btn-primary"
            style={{
              flex: 1,
              background: "var(--color-success)",
              borderColor: "var(--color-success)",
            }}
            onClick={handleComplete}
            disabled={completing}
          >
            {completing ? "Подтверждение..." : "✓ Получил"}
          </button>
        )}
        {isDone && (
          <button
            className="btn btn-primary"
            style={{ flex: 1, background: "var(--fire)" }}
            onClick={async () => {
              const repeat = useOrderStore.getState().repeatOrder;
              await repeat(currentOrder);
              navigate(
                `/restaurant/${
                  currentOrder.restaurant_display_id ||
                  currentOrder.restaurant_id
                }`,
              );
            }}
          >
            Повторить заказ
          </button>
        )}
        {currentOrder.status === "PENDING" && (
          <button
            className="btn btn-secondary"
            style={{
              flex: 1,
              color: "var(--error)",
              borderColor: "var(--error)",
            }}
            onClick={handleCancel}
            disabled={cancelling}
          >
            {cancelling ? "Отмена..." : "Отменить"}
          </button>
        )}
        <button
          className="btn btn-secondary"
          style={{ flex: isDone ? 1 : 2 }}
          onClick={() => navigate("/orders")}
        >
          ← Мои заказы
        </button>
      </div>
    </div>
  );
};

export default OrderStatusPage;
