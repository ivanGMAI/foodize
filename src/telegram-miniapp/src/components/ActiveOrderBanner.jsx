import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useOrderStore } from "../store/useOrderStore";
import { createOrderWebSocket } from "../services/api";

const STATUS_LABEL = {
  PENDING: "Ожидает подтверждения",
  ACCEPTED: "Готовится",
  READY: "Готов к выдаче",
};

const STATUS_COLOR = {
  PENDING: "var(--text-3)",
  ACCEPTED: "var(--brand)",
  READY: "var(--fire)",
};

export default function ActiveOrderBanner() {
  const navigate = useNavigate();
  const activeOrder = useOrderStore((s) => s.activeOrder);
  const setActiveOrder = useOrderStore((s) => s.setActiveOrder);
  const clearActiveOrder = useOrderStore((s) => s.clearActiveOrder);
  const wsRef = useRef(null);

  useEffect(() => {
    if (!activeOrder) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }

    if (wsRef.current) return;

    wsRef.current = createOrderWebSocket(activeOrder.id, (data) => {
      if (data.status) {
        if (["COMPLETED", "CANCELLED"].includes(data.status)) {
          clearActiveOrder();
        } else {
          setActiveOrder({ ...activeOrder, status: data.status });
        }
      }
    });

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [activeOrder, setActiveOrder, clearActiveOrder]);

  if (!activeOrder || !STATUS_LABEL[activeOrder.status]) return null;

  return (
    <div
      onClick={() => navigate(`/orders/${activeOrder.id}`)}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border)",
        padding: "10px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "pointer",
        boxShadow: "var(--shadow-md)",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-3)",
            marginBottom: 1,
          }}
        >
          Заказ #{activeOrder.display_id ?? activeOrder.id?.slice(0, 8)}
        </div>
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: STATUS_COLOR[activeOrder.status],
          }}
        >
          {STATUS_LABEL[activeOrder.status]}
        </div>
      </div>
      <div
        style={{
          fontSize: "0.78rem",
          color: "var(--brand)",
          fontWeight: 600,
          textDecoration: "underline",
        }}
      >
        Смотреть →
      </div>
    </div>
  );
}
