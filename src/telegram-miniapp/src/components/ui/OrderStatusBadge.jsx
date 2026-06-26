import { MapPin, CheckCircle, Smiley, XCircle } from "@phosphor-icons/react";

const OrderStatusBadge = ({ status }) => {
  if (status === "PENDING" || status === "ACCEPTED") {
    return (
      <div className="status-icon-wrap">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="ripple-ring"
            style={{
              width: 80,
              height: 80,
              top: "50%",
              left: "50%",
              marginTop: -40,
              marginLeft: -40,
            }}
          />
        ))}
        <div style={{ position: "relative", zIndex: 1, color: "var(--fire)" }}>
          <MapPin size={64} weight="fill" />
        </div>
        <p
          style={{
            marginTop: 20,
            fontWeight: 800,
            fontSize: "1.4rem",
            letterSpacing: "-0.03em",
          }}
        >
          Ожидается
        </p>
        <p style={{ color: "var(--text-3)", marginTop: 8 }}>
          Ресторан готовит заказ к выдаче
        </p>
      </div>
    );
  }

  if (status === "READY" || status === "COMPLETED") {
    return (
      <div className="status-icon-wrap status-ready-flash">
        <div style={{ marginBottom: 12, color: "#22c55e" }}>
          {status === "COMPLETED" ? (
            <Smiley size={80} weight="fill" />
          ) : (
            <CheckCircle size={80} weight="fill" />
          )}
        </div>
        <p
          className="status-ready-text"
          style={{
            fontWeight: 800,
            fontSize: "2rem",
            letterSpacing: "-0.04em",
            color: "#22c55e",
          }}
        >
          {status === "COMPLETED" ? "Приятного аппетита!" : "Забирай!"}
        </p>
        <p style={{ color: "var(--text-3)", marginTop: 8, fontWeight: 600 }}>
          {status === "COMPLETED"
            ? "Заказ уже получен"
            : "Заказ ждёт тебя на кассе"}
        </p>
      </div>
    );
  }

  if (status === "CANCELLED") {
    return (
      <div className="status-icon-wrap">
        <div style={{ marginBottom: 12, color: "#ef4444" }}>
          <XCircle size={80} weight="fill" />
        </div>
        <p
          style={{
            fontWeight: 800,
            fontSize: "1.6rem",
            letterSpacing: "-0.03em",
            color: "#ef4444",
          }}
        >
          Отменён
        </p>
        <p style={{ color: "var(--text-3)", marginTop: 8 }}>
          Заказ был отменён
        </p>
      </div>
    );
  }

  return null;
};

export default OrderStatusBadge;
