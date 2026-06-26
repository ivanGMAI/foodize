import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Storefront, Clock, CheckCircle, XCircle } from "@phosphor-icons/react";
import { vendorService } from "../../services/vendorService";
import { restaurantService } from "../../services/restaurantService";
import { useAuthStore } from "../../store/useAuthStore";
import { tg } from "../../telegram/sdk";

const STATUS_LABEL = {
  PENDING: "На рассмотрении",
  APPROVED: "Одобрен",
  REJECTED: "Отклонён",
};

const STATUS_ICON = {
  PENDING: <Clock size={20} color="var(--text-3)" />,
  APPROVED: <CheckCircle size={20} color="#22c55e" />,
  REJECTED: <XCircle size={20} color="var(--fire)" />,
};

export default function VendorProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [vendor, setVendor] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
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
        const res = await vendorService.getMyProfile();
        setVendor(res.data.data);
      } catch {
        navigate("/profile");
        return;
      }
      try {
        const rRes = await restaurantService.getAll({ size: 50 });
        const all = rRes.data.data ?? [];
        const mine = all.filter((r) => r.vendor_id === user?.id);
        setRestaurants(mine);
      } catch {}
      setLoading(false);
    }
    load();
  }, [navigate, user?.id]);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
        <div className="spinner" />
      </div>
    );
  }

  const status = vendor?.approval_status ?? "PENDING";

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
          Кабинет вендора
        </h1>
      </div>

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
        {STATUS_ICON[status]}
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
            {STATUS_LABEL[status] ?? status}
          </div>
          {vendor?.rejection_reason && (
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--fire)",
                marginTop: 2,
              }}
            >
              {vendor.rejection_reason}
            </div>
          )}
        </div>
      </div>

      {status === "APPROVED" && (
        <>
          <div style={{ padding: "12px 16px 6px" }}>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--text-3)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Мои рестораны
            </div>
          </div>

          {restaurants.length === 0 ? (
            <div
              style={{
                padding: "12px 16px",
                color: "var(--text-3)",
                fontSize: "0.88rem",
              }}
            >
              Нет ресторанов. Создайте первый в веб-версии Foodize.
            </div>
          ) : (
            restaurants.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <Storefront size={20} />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "0.9rem",
                      fontWeight: 600,
                      color: "var(--text-1)",
                    }}
                  >
                    {r.name}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
                    {r.address}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: r.is_open ? "#22c55e" : "var(--text-3)",
                  }}
                >
                  {r.is_open ? "Открыт" : "Закрыт"}
                </div>
              </div>
            ))
          )}

          <div style={{ padding: 16 }}>
            <button
              className="btn btn-secondary"
              style={{ width: "100%", fontSize: "0.85rem" }}
              onClick={() =>
                tg?.showAlert?.(
                  "Управление меню и настройки доступны в веб-версии Foodize",
                )
              }
            >
              Управление рестораном — веб-версия
            </button>
          </div>
        </>
      )}

      {status === "PENDING" && (
        <div
          style={{
            padding: "12px 16px",
            fontSize: "0.85rem",
            color: "var(--text-2)",
          }}
        >
          Ваша заявка на рассмотрении у администратора. Обычно это занимает до
          24 часов.
        </div>
      )}
    </div>
  );
}
