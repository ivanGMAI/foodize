import { useState } from "react";
import { completeTelegramAuth } from "../../telegram/init";
import { useAuthStore } from "../../store/useAuthStore";
import { translateApiError } from "../../utils/translateApiError";

const PHONE_RE = /^\+?[0-9]{7,15}$/;

export default function RegisterPage({ initData, prefillPhone, onSuccess }) {
  const isLogin = localStorage.getItem("foodize_tg_logged_out") === "1";
  const [phone, setPhone] = useState(prefillPhone ?? "");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");

  const fetchMe = useAuthStore((s) => s.fetchMe);

  const validatePhone = (value) => {
    if (!value) return "Введите номер телефона";
    if (!PHONE_RE.test(value.replace(/[\s().-]/g, "")))
      return "Неверный формат номера (+7XXXXXXXXXX)";
    return "";
  };

  const handlePhoneChange = (e) => {
    const val = e.target.value;
    setPhone(val);
    setPhoneError(validatePhone(val));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const pErr = validatePhone(phone);
    if (pErr) {
      setPhoneError(pErr);
      return;
    }
    setError("");
    setLoading(true);
    try {
      await completeTelegramAuth(
        initData,
        phone,
        name.trim() || "Telegram User",
      );
      await fetchMe();
      onSuccess();
    } catch (err) {
      setError(
        translateApiError(
          err,
          "Не удалось зарегистрироваться. Проверьте данные.",
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 20px",
        background: "var(--bg)",
      }}
    >
      <div style={{ marginBottom: 8, textAlign: "center" }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: "var(--r-lg)",
            background: "var(--fire)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            boxShadow: "0 8px 24px var(--fire-glow)",
          }}
        >
          <span style={{ fontSize: 32 }}>🍽️</span>
        </div>
        <h1
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "1.6rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: "var(--text-1)",
            margin: 0,
          }}
        >
          {isLogin ? "Вход в аккаунт" : "Добро пожаловать"}
        </h1>
        <p
          style={{
            fontSize: "0.9rem",
            color: "var(--text-3)",
            marginTop: 6,
            marginBottom: 32,
          }}
        >
          {isLogin
            ? "Введите телефон аккаунта, в который хотите войти"
            : "Введите данные для регистрации"}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: 360,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div className="form-group">
          <label className="form-label">Номер телефона</label>
          <input
            type="tel"
            value={phone}
            readOnly={!!prefillPhone}
            onChange={prefillPhone ? undefined : handlePhoneChange}
            className={`form-input${phoneError ? " form-input--error" : ""}`}
            placeholder="+7XXXXXXXXXX"
            required
            style={prefillPhone ? { opacity: 0.6, cursor: "not-allowed" } : {}}
          />
          {phoneError && (
            <div
              className="form-error"
              style={{ fontSize: "0.78rem", marginTop: 4 }}
            >
              {phoneError}
            </div>
          )}
        </div>

        {!isLogin && (
          <div className="form-group">
            <label className="form-label">Ваше имя</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
              placeholder="Имя"
              required
              minLength={1}
              maxLength={128}
            />
          </div>
        )}

        {error && <div className="form-error">{error}</div>}

        <button
          type="submit"
          className="btn btn-primary btn-full"
          disabled={loading}
          style={{ marginTop: 4, borderRadius: "var(--r-md)" }}
        >
          {loading ? "Загрузка..." : isLogin ? "Войти" : "Продолжить"}
        </button>
      </form>
    </div>
  );
}
