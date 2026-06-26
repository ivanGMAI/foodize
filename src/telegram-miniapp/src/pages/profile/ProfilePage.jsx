import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Heart,
  SignOut,
  PencilSimple,
  Crown,
  LockKey,
  CaretRight,
  Check,
  X,
  UserCircle,
  Bell,
} from "@phosphor-icons/react";
import { useAuthStore } from "../../store/useAuthStore";
import { useNotificationStore } from "../../store/useNotificationStore";
import { hasPermission, PERMISSIONS } from "../../utils/permissions";
import { useShallow } from "zustand/react/shallow";
import { BackButton } from "../../telegram/sdk";
import { userService } from "../../services/userService";

const ProfilePage = () => {
  const navigate = useNavigate();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const { user, logout, fetchMe } = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      logout: s.logout,
      fetchMe: s.fetchMe,
    })),
  );

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    first_name: "",
    last_name: "",
    email: "",
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [pwForm, setPwForm] = useState({ old_password: "", new_password: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState("");
  const [pwSuccess, setPwSuccess] = useState(false);

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

  const startEdit = () => {
    setEditForm({
      name: user?.name ?? "",
      first_name: user?.first_name ?? "",
      last_name: user?.last_name ?? "",
      email: user?.email ?? "",
    });
    setEditMode(true);
    setEditError("");
  };

  const handleSave = async () => {
    setEditLoading(true);
    setEditError("");
    try {
      await userService.updateMe(editForm);
      await fetchMe();
      setEditMode(false);
      window.Telegram?.WebApp?.showAlert?.("Профиль сохранён");
    } catch {
      setEditError("Не удалось сохранить");
    } finally {
      setEditLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwLoading(true);
    setPwError("");
    setPwSuccess(false);
    try {
      await userService.changePassword(pwForm);
      setPwSuccess(true);
      setPwForm({ old_password: "", new_password: "" });
    } catch (err) {
      const detail = err.response?.data?.detail;
      setPwError(
        typeof detail === "string" ? detail : "Не удалось сменить пароль",
      );
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    window.location.assign("/");
  };

  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.name || "Пользователь";

  return (
    <div
      className="profile-page"
      style={{ paddingBottom: "calc(var(--bottom-tab-h, 68px) + 24px)" }}
    >
      <div className="profile-header" style={{ position: "relative" }}>
        <div className="profile-avatar">
          {editMode ? (
            <UserCircle size={36} weight="bold" color="var(--fire-text)" />
          ) : (
            displayName[0]?.toUpperCase() || "?"
          )}
        </div>

        {!editMode ? (
          <div style={{ flex: 1 }}>
            <div className="profile-name">{displayName}</div>
            <div className="profile-phone">{user?.phone_number || "—"}</div>
            {user?.email && (
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-3)",
                  marginTop: 2,
                }}
              >
                {user.email}
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <input
              className="form-input"
              placeholder="Отображаемое имя"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, name: e.target.value }))
              }
              style={{ fontSize: "0.88rem" }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <input
                className="form-input"
                placeholder="Имя"
                value={editForm.first_name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, first_name: e.target.value }))
                }
                style={{ flex: 1, fontSize: "0.88rem" }}
              />
              <input
                className="form-input"
                placeholder="Фамилия"
                value={editForm.last_name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, last_name: e.target.value }))
                }
                style={{ flex: 1, fontSize: "0.88rem" }}
              />
            </div>
            <input
              className="form-input"
              placeholder="Email"
              type="email"
              value={editForm.email}
              onChange={(e) =>
                setEditForm((f) => ({ ...f, email: e.target.value }))
              }
              style={{ fontSize: "0.88rem" }}
            />
            <input
              className="form-input"
              value={user?.phone_number || ""}
              readOnly
              style={{ fontSize: "0.88rem", opacity: 0.6 }}
            />
            {editError && (
              <div className="form-error" style={{ fontSize: "0.78rem" }}>
                {editError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={editLoading}
                style={{
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                {editLoading ? (
                  "..."
                ) : (
                  <>
                    <Check size={14} /> Сохранить
                  </>
                )}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setEditMode(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {!editMode && (
          <button
            onClick={startEdit}
            style={{
              position: "absolute",
              top: 14,
              right: 14,
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
            aria-label="Редактировать"
          >
            <PencilSimple size={14} />
          </button>
        )}
      </div>

      <div className="profile-menu">
        <div className="profile-menu-item" onClick={() => navigate("/orders")}>
          <Package size={18} />
          <span style={{ flex: 1 }}>Мои заказы</span>
          <CaretRight size={16} color="var(--text-3)" />
        </div>

        <div
          className="profile-menu-item"
          onClick={() => navigate("/favorites")}
        >
          <Heart size={18} color="#ef4444" />
          <span style={{ flex: 1 }}>Избранное</span>
          <CaretRight size={16} color="var(--text-3)" />
        </div>

        <div
          className="profile-menu-item"
          onClick={() => navigate("/notifications")}
        >
          <Bell size={18} />
          <span style={{ flex: 1 }}>Уведомления</span>
          {unreadCount > 0 && (
            <span
              style={{
                background: "var(--fire)",
                color: "var(--fire-text, #fff)",
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                padding: "1px 7px",
                marginRight: 4,
              }}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
          <CaretRight size={16} color="var(--text-3)" />
        </div>

        {hasPermission(user, PERMISSIONS.ADMIN_ACCESS) && (
          <div
            className="profile-menu-item"
            onClick={() =>
              window.Telegram?.WebApp?.showAlert(
                "Панель администратора доступна только в веб-версии Foodize",
              )
            }
          >
            <Crown size={18} color="var(--gold, #e8a200)" />
            <span style={{ flex: 1 }}>Панель администратора</span>
            <CaretRight size={16} color="var(--text-3)" />
          </div>
        )}

        <div
          className="profile-menu-item"
          onClick={() => {
            setShowPassword((p) => !p);
            setPwError("");
            setPwSuccess(false);
          }}
        >
          <LockKey size={18} />
          <span style={{ flex: 1 }}>Сменить пароль</span>
          <CaretRight
            size={16}
            color="var(--text-3)"
            style={{
              transform: showPassword ? "rotate(90deg)" : "none",
              transition: "transform 200ms",
            }}
          />
        </div>

        {showPassword && (
          <form
            onSubmit={handlePasswordChange}
            style={{
              padding: "4px 16px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              borderBottom: "1px solid var(--border)",
            }}
          >
            <input
              className="form-input"
              type="password"
              placeholder="Текущий пароль"
              value={pwForm.old_password}
              onChange={(e) =>
                setPwForm((f) => ({ ...f, old_password: e.target.value }))
              }
              required
            />
            <input
              className="form-input"
              type="password"
              placeholder="Новый пароль (мин. 8 символов)"
              value={pwForm.new_password}
              onChange={(e) =>
                setPwForm((f) => ({ ...f, new_password: e.target.value }))
              }
              minLength={8}
              required
            />
            {pwError && (
              <div className="form-error" style={{ fontSize: "0.78rem" }}>
                {pwError}
              </div>
            )}
            {pwSuccess && (
              <div
                style={{
                  color: "#22c55e",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                }}
              >
                ✓ Пароль изменён
              </div>
            )}
            <button
              className="btn btn-primary btn-sm"
              type="submit"
              disabled={pwLoading}
            >
              {pwLoading ? "..." : "Сохранить пароль"}
            </button>
          </form>
        )}

        <div className="divider" style={{ margin: "8px 0" }} />

        <div className="profile-menu-item danger" onClick={handleLogout}>
          <SignOut size={18} />
          <span style={{ flex: 1 }}>Выйти</span>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
