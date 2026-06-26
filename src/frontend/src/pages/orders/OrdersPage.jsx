import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Clock,
  CheckCircle,
  CaretRight,
  HandPalm,
  XCircle,
} from '@phosphor-icons/react';
import { useOrderStore } from '../../store/useOrderStore';
import EmptyState from '../../components/ui/EmptyState';
import { ROUTES } from '../../constants/routes';
import Pagination from '../../components/ui/Pagination';

const STATUS_CONFIG = {
  PENDING: {
    label: 'Новый',
    className: 'pending',
    icon: <Clock weight="bold" />,
  },
  ACCEPTED: {
    label: 'Принят',
    className: 'pending',
    icon: <CheckCircle weight="bold" />,
  },
  READY: {
    label: 'Готов к выдаче',
    className: 'ready',
    icon: <HandPalm weight="bold" />,
  },
  COMPLETED: {
    label: 'Выдан',
    className: 'ready',
    icon: <CheckCircle weight="fill" />,
  },
  CANCELLED: {
    label: 'Отменён',
    className: 'cancelled',
    icon: <XCircle weight="fill" />,
  },
};

const STATUS_FILTERS = [
  { key: 'ACTIVE', label: 'Активные' },
  { key: 'DONE', label: 'Завершённые' },
];

import { useShallow } from 'zustand/react/shallow';

const getOrderDisplayId = (order) => order.display_id ?? order.id.slice(0, 8);

const formatOrderTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const OrdersPage = () => {
  const { orders, ordersTotal, fetchMyOrders, ordersLoading } = useOrderStore(
    useShallow((s) => ({
      orders: s.orders,
      ordersTotal: s.ordersTotal,
      fetchMyOrders: s.fetchMyOrders,
      ordersLoading: s.ordersLoading,
    }))
  );
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const size = 20;

  useEffect(() => {
    fetchMyOrders({ page, size });
  }, [fetchMyOrders, page]);

  const totalPages = Math.ceil(ordersTotal / size);
  const visibleOrders =
    statusFilter === 'ACTIVE'
      ? orders.filter(
          (o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED'
        )
      : orders.filter(
          (o) => o.status === 'COMPLETED' || o.status === 'CANCELLED'
        );

  return (
    <div className="page-enter" style={{ padding: '28px var(--gutter, 20px)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
        }}
      >
        <Package size={24} weight="bold" color="var(--fire)" />
        <h1
          style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '1.6rem',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            margin: 0,
            color: 'var(--text-1)',
          }}
        >
          Мои заказы
        </h1>
      </div>

      <div
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}
      >
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            className={`category-chip${statusFilter === key ? ' active' : ''}`}
            style={{ fontSize: '0.8rem' }}
            onClick={() => {
              setStatusFilter(key);
              setPage(1);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {ordersLoading && visibleOrders.length === 0 ? (
        <div className="loading-center">
          <div className="spinner" />
        </div>
      ) : visibleOrders.length === 0 ? (
        <EmptyState
          title={
            statusFilter === 'ACTIVE'
              ? 'Активных заказов нет'
              : 'Завершённых заказов нет'
          }
          subtitle={
            statusFilter === 'ACTIVE'
              ? 'Сделайте первый заказ — это займёт меньше минуты'
              : 'Здесь появятся выданные и отменённые заказы'
          }
          action={
            statusFilter === 'ACTIVE'
              ? {
                  label: 'Выбрать заведение',
                  onClick: () => navigate(ROUTES.HOME),
                }
              : undefined
          }
        />
      ) : (
        <div className={ordersLoading ? 'loading-dim' : undefined}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {visibleOrders.map((order) => {
              const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;
              return (
                <div
                  key={order.id}
                  id={`order-card-${order.id}`}
                  className="order-card"
                  onClick={() =>
                    navigate(ROUTES.ORDER_STATUS.replace(':id', order.id))
                  }
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        letterSpacing: '-0.02em',
                        marginBottom: 4,
                        color: 'var(--text-1)',
                      }}
                    >
                      Заказ #{getOrderDisplayId(order)}
                    </div>
                    <div
                      style={{ fontSize: '0.78rem', color: 'var(--text-3)' }}
                    >
                      {order.items?.length || 0} позиций
                      {order.requested_pickup_at
                        ? ` · к ${formatOrderTime(order.requested_pickup_at)}`
                        : ''}
                    </div>
                  </div>

                  <div
                    style={{
                      textAlign: 'right',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 6,
                    }}
                  >
                    <span
                      className={`order-status-badge ${cfg.className}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </span>
                    <span
                      style={{
                        fontWeight: 800,
                        fontSize: '1rem',
                        letterSpacing: '-0.02em',
                        color: 'var(--text-1)',
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
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
