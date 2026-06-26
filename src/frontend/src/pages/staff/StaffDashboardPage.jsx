import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  CookingPot,
  CheckCircle,
  Clock,
  Bell,
  HourglassMedium,
  XCircle,
} from '@phosphor-icons/react';
import { staffService } from '../../services/staffService';
import { STAFF_ROLE_RU, translate } from '../../utils/locales';
import EmptyState from '../../components/ui/EmptyState';
import { createRestaurantOrdersWebSocket } from '../../services/api';

const STATUS_COLOR = {
  PENDING: '#f59e0b',
  ACCEPTED: '#f97316',
  READY: '#22c55e',
  COMPLETED: '#6b7280',
};

const NEXT_STATUS = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'READY',
  READY: 'COMPLETED',
};

const NEXT_LABEL = {
  PENDING: 'Принять',
  ACCEPTED: 'Готов',
  READY: 'Выдать',
};

const COLUMNS = [
  {
    id: 'pending',
    label: 'Новые',
    statuses: ['PENDING'],
    color: '#f59e0b',
    icon: <Clock size={18} weight="fill" />,
  },
  {
    id: 'accepted',
    label: 'Принято',
    statuses: ['ACCEPTED'],
    color: '#f97316',
    icon: <CookingPot size={18} weight="fill" />,
  },
  {
    id: 'ready',
    label: 'Готово',
    statuses: ['READY'],
    color: '#22c55e',
    icon: <CheckCircle size={18} weight="fill" />,
  },
];

const APPLICATION_STATUS_CONFIG = {
  PENDING: {
    icon: <HourglassMedium size={48} color="#f59e0b" weight="fill" />,
    title: 'Заявка на рассмотрении',
    description:
      'Ваша заявка отправлена и ожидает решения менеджера. Обычно это занимает несколько часов.',
    color: '#f59e0b',
    bg: '#f59e0b22',
  },
  ACCEPTED: {
    icon: <CheckCircle size={48} color="#22c55e" weight="fill" />,
    title: 'Заявка одобрена',
    description:
      'Ваша заявка принята. Обратитесь к менеджеру для завершения оформления.',
    color: '#22c55e',
    bg: '#22c55e22',
  },
  REJECTED: {
    icon: <XCircle size={48} color="#ef4444" weight="fill" />,
    title: 'Заявка отклонена',
    description:
      'К сожалению, ваша заявка была отклонена. Вы можете попробовать снова через 24 часа.',
    color: '#ef4444',
    bg: '#ef444422',
  },
};

const getOrderDisplayId = (order) => order.display_id ?? order.id.slice(0, 8);

const buildReadyAtIso = (timeValue) => {
  if (!timeValue) return null;
  const [hours, minutes] = timeValue.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  const readyAt = new Date();
  readyAt.setHours(hours, minutes, 0, 0);
  if (readyAt.getTime() <= Date.now()) readyAt.setDate(readyAt.getDate() + 1);
  return readyAt.toISOString();
};

const getOrderDefaultEta = (order) => {
  const times =
    order.items?.map((i) => i.menu_item_prep_time).filter(Boolean) ?? [];
  return times.length > 0 ? Math.max(...times) : 15;
};

const isRemovalOption = (option) => {
  const name = option.name?.toLowerCase() ?? '';
  return (
    option.price_delta === 0 &&
    (name.startsWith('без') ||
      name.startsWith('убрать') ||
      name.includes('без '))
  );
};

const ApplicationStatus = () => {
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    staffService
      .getMyApplication()
      .then((res) => setApplication(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!application) {
    return (
      <div style={{ padding: '40px 20px', maxWidth: 500, margin: '0 auto' }}>
        <EmptyState
          title="Нет профиля сотрудника"
          subtitle="Вы не привязаны ни к одному заведению. Обратитесь к менеджеру."
        />
      </div>
    );
  }

  const config =
    APPLICATION_STATUS_CONFIG[application.status] ||
    APPLICATION_STATUS_CONFIG.PENDING;

  return (
    <div style={{ padding: '40px 20px', maxWidth: 480, margin: '0 auto' }}>
      <div
        style={{
          background: config.bg,
          border: `1px solid ${config.color}44`,
          borderRadius: 'var(--r-lg)',
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          textAlign: 'center',
        }}
      >
        {config.icon}
        <div>
          <h2
            style={{
              fontWeight: 800,
              fontSize: '1.2rem',
              color: 'var(--text-1)',
              marginBottom: 8,
            }}
          >
            {config.title}
          </h2>
          <p
            style={{
              color: 'var(--text-3)',
              fontSize: '0.875rem',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {config.description}
          </p>
        </div>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)',
            padding: '10px 16px',
            fontSize: '0.78rem',
            color: 'var(--text-3)',
            fontFamily: 'monospace',
          }}
        >
          Заявка #{application.id.slice(0, 8)}
        </div>
      </div>
    </div>
  );
};

const EtaModal = ({ order, onConfirm, onCancel, updating }) => {
  const defaultMinutes = getOrderDefaultEta(order);
  const [etaMinutes, setEtaMinutes] = useState(defaultMinutes);
  const [manualTime, setManualTime] = useState('');

  const payload = () => {
    const iso = buildReadyAtIso(manualTime);
    if (iso) return { estimated_ready_at: iso };
    if (etaMinutes) return { estimated_ready_in_minutes: etaMinutes };
    return null;
  };

  const chips = [
    ...new Set([defaultMinutes, 10, 15, 20, 30].filter(Boolean)),
  ].sort((a, b) => a - b);

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 5000 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="modal-content" style={{ maxWidth: 360, padding: '24px' }}>
        <h3 style={{ fontWeight: 900, fontSize: '1.1rem', marginBottom: 4 }}>
          Заказ #{getOrderDisplayId(order)}
        </h3>
        <p
          style={{
            color: 'var(--text-3)',
            fontSize: '0.8rem',
            marginBottom: 16,
          }}
        >
          Выберите время готовности
        </p>

        <div
          style={{
            display: 'flex',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 12,
          }}
        >
          {chips.map((m) => (
            <button
              key={m}
              type="button"
              className={`category-chip${!manualTime && etaMinutes === m ? ' active' : ''}`}
              onClick={() => {
                setEtaMinutes(m);
                setManualTime('');
              }}
            >
              {m} мин{m === defaultMinutes ? ' *' : ''}
            </button>
          ))}
        </div>

        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            color: 'var(--text-3)',
            fontSize: '0.72rem',
            marginBottom: 8,
          }}
        >
          Или указать точное время
          <input
            type="time"
            value={manualTime}
            onChange={(e) => {
              setManualTime(e.target.value);
              setEtaMinutes(null);
            }}
            style={{
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              background: 'var(--bg)',
              color: 'var(--text-1)',
              padding: '10px 12px',
              font: 'inherit',
              fontWeight: 800,
            }}
          />
        </label>
        <p
          style={{
            color: 'var(--text-3)',
            fontSize: '0.72rem',
            marginBottom: 16,
          }}
        >
          * — рекомендовано по составу заказа
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            style={{ flex: 1 }}
            disabled={updating || !payload()}
            onClick={() => onConfirm(payload())}
          >
            {updating ? '...' : 'Начать готовить'}
          </button>
          <button className="btn btn-secondary" onClick={onCancel}>
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

const formatEta = (isoString) => {
  if (!isoString) return null;
  const diff = Math.round((new Date(isoString) - Date.now()) / 60000);
  if (diff <= 0) return 'время вышло';
  return `~${diff} мин`;
};

const KanbanCard = ({
  order,
  onAdvance,
  onCancel,
  updating,
  dragging,
  onDragStart,
  onDragEnd,
}) => {
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const nextStatus = NEXT_STATUS[order.status];
  const nextLabel = NEXT_LABEL[order.status];
  const elapsed = useElapsedSeconds(
    order.status === 'ACCEPTED' ? order.created_at : null
  );
  const elapsedMins = Math.floor(elapsed / 60);
  const delayUrgency =
    order.status === 'ACCEPTED'
      ? elapsedMins >= 15
        ? 'critical'
        : elapsedMins >= 8
          ? 'warning'
          : null
      : null;
  const canCancel = order.status === 'PENDING' || order.status === 'ACCEPTED';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: 'var(--bg-card)',
        border: `1px solid var(--border)`,
        borderLeft: `4px solid ${STATUS_COLOR[order.status] || 'var(--border)'}`,
        borderRadius: 'var(--r-md)',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'grab',
        opacity: dragging ? 0.4 : 1,
        transition: 'opacity 0.15s',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{
            fontWeight: 900,
            fontSize: '1.15rem',
            color: 'var(--text-1)',
          }}
        >
          #{getOrderDisplayId(order)}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {delayUrgency && (
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 800,
                color: delayUrgency === 'critical' ? '#ef4444' : '#f59e0b',
                background:
                  delayUrgency === 'critical'
                    ? 'rgba(239,68,68,0.12)'
                    : 'rgba(245,158,11,0.1)',
                border: `1px solid ${delayUrgency === 'critical' ? '#ef4444' : '#f59e0b'}`,
                borderRadius: 99,
                padding: '2px 8px',
              }}
            >
              {delayUrgency === 'critical'
                ? `🔥 ${elapsedMins}м`
                : `⏱ ${elapsedMins}м`}
            </span>
          )}
          <span
            style={{
              fontSize: '0.8rem',
              color: 'var(--text-3)',
              fontWeight: 600,
            }}
          >
            {order.total_price} ₽
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {order.items?.map((item) => (
          <div key={item.id}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.84rem',
                color: 'var(--text-2)',
              }}
            >
              <span>{item.menu_item_name ?? item.name ?? 'Позиция'}</span>
              <span
                style={{
                  fontWeight: 700,
                  color: 'var(--text-1)',
                  marginLeft: 8,
                }}
              >
                ×{item.quantity}
              </span>
            </div>
            {item.selected_options?.length > 0 && (
              <div style={{ paddingLeft: 4, marginTop: 1 }}>
                {item.selected_options.map((opt) => (
                  <span
                    key={opt.id}
                    style={{
                      fontSize: '0.72rem',
                      color: isRemovalOption(opt) ? '#ef4444' : 'var(--text-3)',
                      marginRight: 6,
                    }}
                  >
                    {opt.name}
                    {opt.price_delta ? ` +${opt.price_delta}₽` : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {order.comment && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            paddingTop: 8,
            fontSize: '0.78rem',
            color: 'var(--text-3)',
            fontStyle: 'italic',
          }}
        >
          💬 {order.comment}
        </div>
      )}

      {order.status === 'ACCEPTED' && order.estimated_ready_at && (
        <div style={{ fontSize: '0.75rem', color: '#f97316', fontWeight: 700 }}>
          ⏱ {formatEta(order.estimated_ready_at)}
        </div>
      )}

      {order.requested_pickup_at && (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-3)',
            fontWeight: 700,
          }}
        >
          Ко времени:{' '}
          {new Intl.DateTimeFormat('ru-RU', {
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(order.requested_pickup_at))}
        </div>
      )}

      {showCancelForm ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Причина отмены (необязательно)"
            style={{
              width: '100%',
              minHeight: 64,
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--border)',
              padding: '6px 8px',
              fontSize: '0.8rem',
              resize: 'vertical',
              background: 'var(--bg-input)',
              color: 'var(--text-1)',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-secondary"
              style={{ flex: 1, height: 32, fontSize: '0.78rem' }}
              onClick={(e) => {
                e.stopPropagation();
                setShowCancelForm(false);
                setCancelReason('');
              }}
            >
              Назад
            </button>
            <button
              className="btn"
              style={{
                flex: 1,
                height: 32,
                fontSize: '0.78rem',
                background: '#ef4444',
                color: '#fff',
                border: 'none',
              }}
              disabled={updating === order.id}
              onClick={(e) => {
                e.stopPropagation();
                onCancel(order.id, cancelReason || null);
                setShowCancelForm(false);
                setCancelReason('');
              }}
            >
              {updating === order.id ? '...' : 'Подтвердить'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          {nextStatus && (
            <button
              className={
                order.status === 'READY'
                  ? 'btn btn-primary'
                  : 'btn btn-secondary'
              }
              style={{ flex: 1, height: 36, fontSize: '0.8rem' }}
              disabled={updating === order.id}
              onClick={(e) => {
                e.stopPropagation();
                onAdvance(order);
              }}
            >
              {updating === order.id ? '...' : nextLabel}
            </button>
          )}
          {canCancel && onCancel && (
            <button
              style={{
                height: 44,
                minHeight: 44,
                width: 44,
                minWidth: 44,
                borderRadius: 'var(--r-sm)',
                border: '1px solid #ef444466',
                background: 'transparent',
                color: '#ef4444',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              disabled={updating === order.id}
              onClick={(e) => {
                e.stopPropagation();
                setShowCancelForm(true);
              }}
            >
              <XCircle size={18} weight="fill" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const KanbanColumn = ({
  column,
  orders,
  onAdvance,
  onCancel,
  updating,
  draggingId,
  onDragStart,
  onDragEnd,
  onDrop,
}) => {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        onDrop(column);
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 'var(--r-md) var(--r-md) 0 0',
          background: `${column.color}18`,
          border: `1px solid ${column.color}44`,
          borderBottom: 'none',
        }}
      >
        <span style={{ color: column.color }}>{column.icon}</span>
        <span
          style={{
            fontWeight: 800,
            fontSize: '0.9rem',
            color: 'var(--text-1)',
          }}
        >
          {column.label}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            background: `${column.color}33`,
            color: column.color,
            borderRadius: '999px',
            padding: '1px 8px',
            fontSize: '0.78rem',
            fontWeight: 800,
          }}
        >
          {orders.length}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 120,
          padding: '10px',
          borderRadius: '0 0 var(--r-md) var(--r-md)',
          border: `1px solid ${dragOver ? column.color : 'var(--border)'}`,
          borderTop: 'none',
          background: dragOver ? `${column.color}08` : 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        {orders.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-3)',
              fontSize: '0.78rem',
            }}
          >
            Пусто
          </div>
        )}
        {orders.map((order) => (
          <KanbanCard
            key={order.id}
            order={order}
            onAdvance={onAdvance}
            onCancel={onCancel}
            updating={updating}
            dragging={draggingId === order.id}
            onDragStart={() => onDragStart(order)}
            onDragEnd={onDragEnd}
          />
        ))}
      </div>
    </div>
  );
};

const useElapsedSeconds = (startIso) => {
  const [seconds, setSeconds] = useState(
    startIso ? Math.floor((Date.now() - new Date(startIso)) / 1000) : 0
  );
  useEffect(() => {
    if (!startIso) return;
    const id = setInterval(() => {
      setSeconds(Math.floor((Date.now() - new Date(startIso)) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [startIso]);
  return seconds;
};

const StaffDashboardPage = () => {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const [orders, setOrders] = useState([]);

  const [ordersLoading, setOrdersLoading] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [activeTab, setActiveTab] = useState('orders');
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const [menuItems, setMenuItems] = useState([]);
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuError, setMenuError] = useState('');

  const [draggingOrderId, setDraggingOrderId] = useState(null);
  const [etaOrder, setEtaOrder] = useState(null);
  const [autoEta, setAutoEta] = useState(
    () => localStorage.getItem('staff_auto_eta') === 'true'
  );

  const draggingOrderRef = useRef(null);
  const prevOrderIds = useRef(new Set());
  const wsRef = useRef(null);

  useEffect(() => {
    staffService
      .getMyProfile()
      .then((res) => setProfile(res.data.data))
      .catch(() => setProfileError('Профиль сотрудника не найден'))
      .finally(() => setProfileLoading(false));
  }, []);

  const fetchOrders = useCallback(
    async (silent = false) => {
      if (!profile?.restaurant_id) return;
      if (!silent) setOrdersLoading(true);
      try {
        const res = await staffService.getRestaurantOrders(
          profile.restaurant_id,
          { page: 1, size: 100 }
        );
        const list = Array.isArray(res.data?.data) ? res.data.data : [];

        const activeList = list
          .filter((o) => o.status !== 'COMPLETED')
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const incoming = new Set(activeList.map((o) => o.id));
        if (prevOrderIds.current.size > 0) {
          const hasNew = [...incoming].some(
            (id) => !prevOrderIds.current.has(id)
          );
          if (hasNew) setNewOrderAlert(true);
        }
        prevOrderIds.current = incoming;
        setOrders(activeList);
      } catch {
      } finally {
        if (!silent) setOrdersLoading(false);
      }
    },
    [profile?.restaurant_id]
  );

  const fetchMenu = useCallback(async () => {
    if (!profile?.restaurant_id) return;
    setMenuLoading(true);
    setMenuError('');
    try {
      const res = await staffService.getMenu(profile.restaurant_id);
      setMenuItems(Array.isArray(res.data?.data) ? res.data.data : []);
    } catch {
      setMenuError('Не удалось загрузить меню');
    } finally {
      setMenuLoading(false);
    }
  }, [profile?.restaurant_id]);

  useEffect(() => {
    if (profile?.restaurant_id) {
      if (activeTab === 'orders') {
        fetchOrders();
        wsRef.current = createRestaurantOrdersWebSocket(
          profile.restaurant_id,
          () => fetchOrders(true)
        );
      } else if (activeTab === 'menu') {
        fetchMenu();
      }
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [activeTab, fetchMenu, fetchOrders, profile?.restaurant_id]);

  const doStatusChange = async (orderId, newStatus, data = {}) => {
    setUpdating(orderId);
    try {
      await staffService.updateOrderStatus(orderId, newStatus, data);
      await fetchOrders(true);
    } catch {
    } finally {
      setUpdating(null);
    }
  };

  const acceptOrder = async (orderId, etaPayload) => {
    setUpdating(orderId);
    try {
      await staffService.updateOrderStatus(orderId, 'ACCEPTED', etaPayload);
      await fetchOrders(true);
    } catch {
    } finally {
      setUpdating(null);
    }
  };

  const triggerCooking = (order) => {
    if (autoEta) {
      acceptOrder(order.id, {
        estimated_ready_in_minutes: getOrderDefaultEta(order),
      });
    } else {
      setEtaOrder(order);
    }
  };

  const handleAdvance = (order) => {
    if (order.status === 'PENDING') {
      triggerCooking(order);
    } else {
      const next = NEXT_STATUS[order.status];
      if (next) doStatusChange(order.id, next);
    }
  };

  const handleCancelOrder = async (orderId, reason) => {
    setUpdating(orderId);
    try {
      await staffService.cancelOrder(orderId, reason);
      await fetchOrders(true);
    } catch {
    } finally {
      setUpdating(null);
    }
  };

  const handleDrop = (column) => {
    const order = draggingOrderRef.current;
    if (!order) return;
    const currentCol = COLUMNS.find((c) => c.statuses.includes(order.status));
    if (!currentCol || currentCol.id === column.id) return;

    if (column.id === 'accepted' && order.status === 'PENDING') {
      triggerCooking(order);
    } else if (column.id === 'ready' && order.status === 'ACCEPTED') {
      doStatusChange(order.id, 'READY');
    }
  };

  const handleEtaConfirm = (etaPayload) => {
    const order = etaOrder;
    setEtaOrder(null);
    if (order) acceptOrder(order.id, etaPayload);
  };

  const handleToggleAvailability = async (item) => {
    const newVal = !item.is_available;
    setMenuItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, is_available: newVal } : i))
    );
    try {
      await staffService.toggleMenuItemAvailability(
        profile.restaurant_id,
        item.id,
        newVal
      );
    } catch {
      setMenuItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, is_available: !newVal } : i
        )
      );
      setMenuError('Не удалось изменить статус блюда');
    }
  };

  if (profileLoading) {
    return (
      <div className="loading-center" style={{ minHeight: '60vh' }}>
        <div className="spinner" />
      </div>
    );
  }

  if (profileError || !profile) {
    return <ApplicationStatus />;
  }

  return (
    <div
      className="page-enter"
      style={{ padding: '24px 16px', maxWidth: 1100, margin: '0 auto' }}
    >
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <CookingPot size={28} weight="fill" color="var(--fire)" />
          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '1.8rem',
              fontWeight: 800,
              color: 'var(--text-1)',
              margin: 0,
            }}
          >
            Кабинет сотрудника
          </h1>
          {newOrderAlert && (
            <button
              style={{
                background: '#22c55e',
                border: 'none',
                borderRadius: 'var(--r-sm)',
                padding: '4px 10px',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              onClick={() => setNewOrderAlert(false)}
            >
              <Bell size={12} weight="fill" />
              Новый заказ!
            </button>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <p
            style={{ color: 'var(--text-3)', fontSize: '0.875rem', margin: 0 }}
          >
            Роль:{' '}
            <strong style={{ color: 'var(--text-2)' }}>
              {translate(STAFF_ROLE_RU, profile.role, profile.role)}
            </strong>
          </p>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '5px 10px',
              borderRadius: 'var(--r-sm)',
              border: `1px solid ${autoEta ? 'var(--fire)' : 'var(--border)'}`,
              background: autoEta ? 'var(--fire-subtle)' : 'var(--bg-card)',
              transition: 'all 0.15s',
              userSelect: 'none',
            }}
          >
            <input
              type="checkbox"
              checked={autoEta}
              onChange={(e) => {
                setAutoEta(e.target.checked);
                localStorage.setItem('staff_auto_eta', e.target.checked);
              }}
              style={{
                width: 14,
                height: 14,
                cursor: 'pointer',
                accentColor: 'var(--fire)',
              }}
            />
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: autoEta ? 'var(--fire)' : 'var(--text-2)',
                whiteSpace: 'nowrap',
              }}
            >
              Авто-время по блюдам
            </span>
          </label>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 16,
          borderBottom: '1px solid var(--border)',
          marginBottom: 20,
        }}
      >
        {[
          { id: 'orders', label: 'Заказы' },
          { id: 'menu', label: 'Стоп-лист' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 4px',
              background: 'none',
              border: 'none',
              borderBottom:
                activeTab === tab.id ? '2px solid var(--fire)' : 'none',
              color: activeTab === tab.id ? 'var(--text-1)' : 'var(--text-3)',
              fontWeight: activeTab === tab.id ? 700 : 500,
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'orders' && (
        <>
          {ordersLoading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : (
            <>
              {(() => {
                const criticalOrders = orders.filter(
                  (o) =>
                    o.status === 'ACCEPTED' &&
                    Math.floor((Date.now() - new Date(o.created_at)) / 60000) >=
                      15
                );
                return criticalOrders.length > 0 ? (
                  <div
                    style={{
                      padding: '10px 16px',
                      marginBottom: 12,
                      background: 'rgba(239,68,68,0.1)',
                      border: '1px solid #ef4444',
                      borderRadius: 'var(--r-md)',
                      color: '#ef4444',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    🔥 {criticalOrders.length}{' '}
                    {criticalOrders.length === 1
                      ? 'заказ задерживается'
                      : criticalOrders.length < 5
                        ? 'заказа задерживается'
                        : 'заказов задерживается'}{' '}
                    — проверьте принятые
                  </div>
                ) : null;
              })()}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 16,
                  alignItems: 'start',
                }}
              >
                {COLUMNS.map((col) => {
                  const colOrders = orders.filter((o) =>
                    col.statuses.includes(o.status)
                  );
                  return (
                    <KanbanColumn
                      key={col.id}
                      column={col}
                      orders={colOrders}
                      onAdvance={handleAdvance}
                      onCancel={handleCancelOrder}
                      updating={updating}
                      draggingId={draggingOrderId}
                      onDragStart={(order) => {
                        draggingOrderRef.current = order;
                        setDraggingOrderId(order.id);
                      }}
                      onDragEnd={() => {
                        setTimeout(() => {
                          draggingOrderRef.current = null;
                          setDraggingOrderId(null);
                        }, 0);
                      }}
                      onDrop={handleDrop}
                    />
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {activeTab === 'menu' && (
        <div>
          {menuLoading ? (
            <div className="loading-center">
              <div className="spinner" />
            </div>
          ) : menuError ? (
            <div className="form-error">{menuError}</div>
          ) : menuItems.length === 0 ? (
            <EmptyState
              title="Меню пусто"
              subtitle="В этом ресторане пока нет блюд"
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)',
                    opacity: item.is_available ? 1 : 0.6,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.95rem',
                        color: 'var(--text-1)',
                      }}
                    >
                      {item.name}
                    </div>
                    <div
                      style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}
                    >
                      {item.price} ₽
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleAvailability(item)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '20px',
                      border: '1px solid var(--border)',
                      background: item.is_available
                        ? 'var(--fire-subtle)'
                        : 'var(--bg-raised)',
                      color: item.is_available
                        ? 'var(--fire)'
                        : 'var(--text-3)',
                      fontSize: '0.7rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {item.is_available ? 'ВКЛ' : 'ВЫКЛ'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {etaOrder &&
        createPortal(
          <EtaModal
            order={etaOrder}
            onConfirm={handleEtaConfirm}
            onCancel={() => setEtaOrder(null)}
            updating={updating === etaOrder.id}
          />,
          document.body
        )}
    </div>
  );
};

export default StaffDashboardPage;
