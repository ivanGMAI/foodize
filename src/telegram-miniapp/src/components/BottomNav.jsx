import { useNavigate, useLocation } from "react-router-dom";
import { Storefront, Package, User } from "@phosphor-icons/react";
import { useNotificationStore } from "../store/useNotificationStore";

const TABS = [
  { path: "/", icon: Storefront, label: "Рестораны" },
  { path: "/orders", icon: Package, label: "Заказы" },
  { path: "/profile", icon: User, label: "Профиль" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const connectionStatus = useNotificationStore((s) => s.connectionStatus);
  const hasConnectionIssue =
    connectionStatus === "reconnecting" || connectionStatus === "closed";

  const isActive = (path) =>
    path === "/" ? pathname === "/" : pathname.startsWith(path);

  return (
    <div className="bottom-tab-bar">
      {TABS.map(({ path, icon: Icon, label }) => {
        const active = isActive(path);
        const showBadge = path === "/profile" && unreadCount > 0;
        const showConnectionBadge = path === "/profile" && hasConnectionIssue;
        return (
          <button
            key={path}
            className={`bottom-tab${active ? " active" : ""}`}
            onClick={() => navigate(path)}
          >
            <span className="bottom-tab-icon" style={{ position: "relative" }}>
              <Icon size={22} weight={active ? "fill" : "regular"} />
              {showBadge && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -6,
                    background: "var(--fire)",
                    color: "var(--fire-text, #fff)",
                    borderRadius: "50%",
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 16,
                    height: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    lineHeight: 1,
                  }}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
              {showConnectionBadge && !showBadge && (
                <span
                  title="Нет соединения с уведомлениями"
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -4,
                    width: 9,
                    height: 9,
                    background: "#ef4444",
                    borderRadius: "50%",
                    border: "2px solid var(--bg-base)",
                  }}
                />
              )}
            </span>
            <span className="bottom-tab-label">{label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default BottomNav;
