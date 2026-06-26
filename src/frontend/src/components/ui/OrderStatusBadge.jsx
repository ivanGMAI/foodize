import { MapPin, CheckCircle, XCircle } from '@phosphor-icons/react';

const OrderStatusBadge = ({ status, cancellationReason }) => {
  if (status === 'PENDING' || status === 'ACCEPTED') {
    return (
      <div className="status-icon-wrap">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="ripple-ring"
            style={{
              width: 80,
              height: 80,
              top: '50%',
              left: '50%',
              marginTop: -40,
              marginLeft: -40,
            }}
          />
        ))}
        <div style={{ position: 'relative', zIndex: 1, color: 'var(--fire)' }}>
          <MapPin size={64} weight="fill" />
        </div>
        <p className="status-heading">
          {status === 'ACCEPTED' ? 'Принят' : 'Новый'}
        </p>
        <p className="status-sub">
          {status === 'ACCEPTED'
            ? 'Ресторан подтвердил заказ'
            : 'Ожидаем подтверждения ресторана'}
        </p>
      </div>
    );
  }

  if (status === 'READY' || status === 'COMPLETED') {
    return (
      <div className="status-icon-wrap status-ready-flash">
        <div style={{ marginBottom: 12, color: 'var(--color-success)' }}>
          <CheckCircle size={80} weight="fill" />
        </div>
        <p
          className={`status-ready-text status-heading${status === 'READY' ? ' status-ready-urge' : ''}`}
          style={{ color: 'var(--color-success)' }}
        >
          {status === 'COMPLETED' ? 'Заказ получен' : 'Забирай!'}
        </p>
        <p className="status-sub" style={{ fontWeight: 600 }}>
          {status === 'COMPLETED'
            ? 'Заказ уже выдан'
            : 'Заказ ждёт тебя на кассе'}
        </p>
      </div>
    );
  }

  if (status === 'CANCELLED') {
    return (
      <div className="status-icon-wrap">
        <div style={{ marginBottom: 12, color: 'var(--color-error, #ef4444)' }}>
          <XCircle size={80} weight="fill" />
        </div>
        <p
          className="status-heading"
          style={{ color: 'var(--color-error, #ef4444)' }}
        >
          Отменён
        </p>
        <p className="status-sub">
          {cancellationReason || 'Заказ был отменён'}
        </p>
      </div>
    );
  }

  return null;
};

export default OrderStatusBadge;
