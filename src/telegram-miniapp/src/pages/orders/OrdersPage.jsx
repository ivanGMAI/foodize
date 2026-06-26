import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Clock,
  CheckCircle,
  CaretRight,
  HandPalm,
  X,
} from "@phosphor-icons/react";
import { useOrderStore } from "../../store/useOrderStore";
import { useShallow } from "zustand/react/shallow";
import { BackButton } from "../../telegram/sdk";
import EmptyState from "../../components/ui/EmptyState";
import Pagination from "../../components/ui/Pagination";

const STATUS_CONFIG = {
  PENDING: {
    label: "Ожидается",
    color: "#f59e0b",
    icon: <Clock weight="bold" />,
  },
  ACCEPTED: {
    label: "Принят",
    color: "#3b82f6",
    icon: <CheckCircle weight="bold" />,
  },
  READY: {
    label: "Готово",
    color: "#22c55e",
    icon: <HandPalm weight="bold" />,
  },
  COMPLETED: {
    label: "Выполнено",
    color: "#6b7280",
    icon: <CheckCircle weight="fill" />,
  },
  CANCELLED: {
    label: "Отменён",
    color: "#ef4444",
    icon: <X weight="bold" />,
  },
};

const STATUS_FILTERS = [
  { key: "", label: "Все" },
  { key: "ACTIVE", label: "Ожидается" },
  { key: "COMPLETED", label: "Выполнено" },
];

const getDisplayId = (order) => order.display_id ?? order.id.slice(0, 8);

const formatOrderTime = (value) => {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const { orders, ordersTotal, fetchMyOrders, ordersLoading } = useOrderStore(
    useShallow((s) => ({
      orders: s.orders,
      ordersTotal: s.ordersTotal,
      fetchMyOrders: s.fetchMyOrders,
      ordersLoading: s.ordersLoading,
    })),
  );
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const size = 20;
  const totalPages = Math.ceil(ordersTotal / size) || 1;

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
    fetchMyOrders({
      page,
      size,
      status: statusFilter === "COMPLETED" ? "COMPLETED" : undefined,
    });
  }, [fetchMyOrders, page, statusFilter]);
  const visibleOrders =
    statusFilter === "ACTIVE"
      ? orders.filter((order) => order.status !== "COMPLETED")
      : orders;

  return (
    <div
      style={{ padding: "16px 16px calc(var(--bottom-tab-h, 68px) + 24px)" }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <Package size={22} weight="fill" color="var(--fire)" />
        <span
          style={{
            fontWeight: 800,
            fontSize: "1.1rem",
            color: "var(--text-1)",
          }}
        >
          Мои заказы
        </span>
      </div>

      <div
        style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}
      >
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            className={`category-chip${statusFilter === key ? " active" : ""}`}
            style={{ fontSize: "0.78rem" }}
            onClick={() => {
              setStatusFilter(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {ordersLoading ? (
        <div className="loading-center">
          <div className="spinner" />
        </div>
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          title="Заказов пока нет"
          subtitle="Сделайте первый заказ в любом ресторане"
          action={{ label: "Выбрать заведение", onClick: () => navigate("/") }}
        />
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {visibleOrders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING;
              return (
                <div
                  key={order.id}
                  className="order-card"
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        color: "var(--text-1)",
                        marginBottom: 3,
                      }}
                    >
                      Заказ #{getDisplayId(order)}
                    </div>
                    <div
                      style={{ fontSize: "0.78rem", color: "var(--text-3)" }}
                    >
                      {order.items?.length || 0} позиций
                      {order.requested_pickup_at
                        ? ` · к ${formatOrderTime(order.requested_pickup_at)}`
                        : ""}
                    </div>
                  </div>
                  <div
                    style={{
                      textAlign: "right",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-end",
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        background: `${cfg.color}1a`,
                        color: cfg.color,
                        borderRadius: 20,
                        padding: "3px 10px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                      }}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: "0.95rem",
                        color: "var(--text-1)",
                      }}
                    >
                      {order.total_price} ₽
                    </span>
                  </div>
                  <CaretRight
                    size={18}
                    color="var(--text-3)"
                    style={{ marginLeft: 4, flexShrink: 0 }}
                  />
                </div>
              );
            })}
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
};

export default OrdersPage;
