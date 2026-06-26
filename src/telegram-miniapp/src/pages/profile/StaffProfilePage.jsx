import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CookingPot, Clock, CheckCircle, XCircle } from "@phosphor-icons/react";
import { staffService } from "../../services/staffService";
import { tg } from "../../telegram/sdk";

const STATUS_LABEL = {
  PENDING: "На рассмотрении",
  APPROVED: "Принят",
  REJECTED: "Отклонён",
};

const STATUS_ICON = {
  PENDING: <Clock size={20} color="var(--text-3)" />,
  APPROVED: <CheckCircle size={20} color="#22c55e" />,
  REJECTED: <XCircle size={20} color="var(--fire)" />,
};

export default function StaffProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tg?.BackButton) {
      tg.BackButton.show();
      const handler = () => navigate("/profile");
      tg.BackButton.onClick(handler);
      return () => {
        tg.BackButton.offClick(handler);
        tg.BackButton.hide();
      };
    }
  }, [navigate]);

  useEffect(() => {
    async function load() {
      try {
        const res = await staffService.getMyProfile();
        setProfile(res.data.data);
      } catch {}
      try {
        const res = await staffService.getMyApplication();
        setApplication(res.data.data);
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ padding: "16px 16px 8px" }}>
        <h1
          style={{
            fontSize: "1.1rem",
            fontWeight: 700,
            color: "var(--text-1)",
            margin: 0,
          }}
        >
          Кабинет сотрудника
        </h1>
      </div>

      {profile ? (
        <div
          style={{
            margin: "8px 16px",
            padding: 16,
            background: "var(--bg-card)",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <CookingPot size={20} color="var(--fire)" />
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
              Ресторан
            </div>
            <div
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "var(--text-1)",
              }}
            >
              {profile.restaurant_name ?? profile.restaurant_id ?? "—"}
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--text-3)",
                marginTop: 2,
              }}
            >
              Управление заказами доступно в веб-версии Foodize
            </div>
          </div>
        </div>
      ) : application ? (
        <div
          style={{
            margin: "8px 16px",
            padding: 16,
            background: "var(--bg-card)",
            borderRadius: "var(--r-md)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          {STATUS_ICON[application.status] ?? STATUS_ICON.PENDING}
          <div>
            <div style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
              Статус заявки
            </div>
            <div
              style={{
                fontSize: "0.95rem",
                fontWeight: 600,
                color: "var(--text-1)",
              }}
            >
              {STATUS_LABEL[application.status] ?? application.status}
            </div>
            {application.status === "PENDING" && (
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-2)",
                  marginTop: 2,
                }}
              >
                Ожидайте ответа от ресторана
              </div>
            )}
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "16px",
            fontSize: "0.88rem",
            color: "var(--text-3)",
          }}
        >
          Нет активных заявок. Подайте заявку через страницу ресторана.
        </div>
      )}
    </div>
  );
}
