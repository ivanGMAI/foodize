import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trash, BellSlash } from "@phosphor-icons/react";
import { useNotificationStore } from "../../store/useNotificationStore";
import { tg } from "../../telegram/sdk";

function getDayLabel(diffDays) {
  if (diffDays === 0) return "Сегодня";
  if (diffDays === 1) return "Вчера";
  const n = diffDays % 100;
  const m = diffDays % 10;
  const suffix =
    n >= 11 && n <= 14
      ? "дней"
      : m === 1
        ? "день"
        : m >= 2 && m <= 4
          ? "дня"
          : "дней";
  return `${diffDays} ${suffix} назад`;
}

function groupByDay(notifications) {
  const now = new Date();
  const groups = [];
  const map = {};

  for (const n of notifications) {
    const diffDays = Math.floor((now - new Date(n.created_at)) / 86400000);
    const label = getDayLabel(diffDays);
    if (!map[label]) {
      map[label] = [];
      groups.push({ label, items: map[label] });
    }
    map[label].push(n);
  }
  return groups;
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const NotificationSkeleton = () => (
  <div style={{ padding: "0 0 8px" }}>
    {[1, 2, 3, 4].map((i) => (
      <div
        key={i}
        style={{
          display: "flex",
          gap: 12,
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          className="skeleton"
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            flexShrink: 0,
            marginTop: 5,
          }}
        />
        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}
        >
          <div
            className="skeleton"
            style={{ width: `${55 + i * 8}%`, height: 13 }}
          />
          <div
            className="skeleton"
            style={{ width: `${70 + i * 5}%`, height: 11 }}
          />
          <div
            className="skeleton"
            style={{ width: 40, height: 10, marginTop: 2 }}
          />
        </div>
      </div>
    ))}
  </div>
);

export default function NotificationsPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const {
    notifications,
    total,
    unreadCount,
    fetchNotifications,
    loadMore,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    deleteAll,
  } = useNotificationStore();

  useEffect(() => {
    fetchNotifications(1).finally(() => setLoading(false));

    if (tg?.BackButton) {
      tg.BackButton.show();
      const handler = () => navigate("/profile");
      tg.BackButton.onClick(handler);
      return () => {
        tg.BackButton.offClick(handler);
        tg.BackButton.hide();
      };
    }
  }, [fetchNotifications, navigate]);

  const handleLoadMore = async () => {
    setLoadingMore(true);
    try {
      await loadMore();
    } finally {
      setLoadingMore(false);
    }
  };

  const groups = groupByDay(notifications);
  const hasMore = notifications.length < total;

  return (
    <div style={{ paddingBottom: "calc(var(--bottom-tab-h, 68px) + 24px)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 16px 8px",
          position: "sticky",
          top: 0,
          background: "var(--bg)",
          zIndex: 10,
        }}
      >
        <h1
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--text-1)",
            margin: 0,
          }}
        >
          Уведомления
        </h1>
        <div style={{ display: "flex", gap: 8 }}>
          {unreadCount > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={markAllAsRead}
            >
              Прочитать все
            </button>
          )}
          {notifications.length > 0 && (
            <button
              className="btn btn-ghost btn-icon"
              aria-label="Удалить все"
              onClick={deleteAll}
            >
              <Trash size={18} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <NotificationSkeleton />
      ) : notifications.length === 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "40vh",
            gap: 12,
            color: "var(--text-3)",
          }}
        >
          <BellSlash size={48} weight="thin" />
          <span style={{ fontSize: "0.9rem" }}>Нет уведомлений</span>
        </div>
      ) : (
        <>
          {groups.map(({ label, items }) => (
            <div key={label}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--text-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  padding: "8px 16px 4px",
                }}
              >
                {label}
              </div>
              {items.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.is_read && markAsRead(n.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "12px 16px",
                    background: n.is_read
                      ? "transparent"
                      : "var(--brand-alpha)",
                    borderBottom: "1px solid var(--border)",
                    cursor: n.is_read ? "default" : "pointer",
                  }}
                >
                  {!n.is_read && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "var(--brand)",
                        flexShrink: 0,
                        marginTop: 5,
                      }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "var(--text-1)",
                        marginBottom: 2,
                      }}
                    >
                      {n.title}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-2)" }}>
                      {n.message}
                    </div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-3)",
                        marginTop: 4,
                      }}
                    >
                      {formatTime(n.created_at)}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: 4, flexShrink: 0 }}
                    aria-label="Удалить"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(n.id);
                    }}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              ))}
            </div>
          ))}

          {hasMore && (
            <div style={{ padding: "12px 16px" }}>
              <button
                className="btn btn-secondary"
                style={{ width: "100%" }}
                disabled={loadingMore}
                onClick={handleLoadMore}
              >
                {loadingMore ? (
                  <span
                    className="spinner"
                    style={{ width: 16, height: 16, borderWidth: 2 }}
                  />
                ) : (
                  "Загрузить ещё"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
