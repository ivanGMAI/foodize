import { useCallback, useEffect, useState } from 'react';
import {
  Clock,
  Package,
  UserCircle,
  X,
  Storefront,
  XCircle,
} from '@phosphor-icons/react';
import { orderService } from '../../services/orderService';

import { ORDER_STATUS_RU, CATEGORY_RU, translate } from '../../utils/locales';
import { permissionPresetLabel } from '../../utils/permissions';

const STATUS_LABEL_RU = ORDER_STATUS_RU;

const STATUS_FLOW = ['PENDING', 'ACCEPTED', 'READY', 'COMPLETED'];

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const optionLabel = (option) =>
  `${option.name}${option.price_delta ? ` +${option.price_delta} ₽` : ''}`;

const buildReadyAtIso = (timeValue) => {
  if (!timeValue) return null;

  const [hours, minutes] = timeValue.split(':').map(Number);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  const readyAt = new Date();
  readyAt.setHours(hours, minutes, 0, 0);
  if (readyAt.getTime() <= Date.now()) {
    readyAt.setDate(readyAt.getDate() + 1);
  }

  return readyAt.toISOString();
};

const getOrderDisplayId = (order) => order.display_id ?? order.id.slice(0, 8);

const extractEvents = (response) => {
  if (Array.isArray(response?.data?.data)) return response.data.data;
  if (Array.isArray(response?.data)) return response.data;
  return [];
};

const getOrderStages = (order, events) => {
  const eventByStatus = new Map(
    (events || []).map((event) => [event.new_status, event])
  );
  const currentIndex = STATUS_FLOW.indexOf(order.status);

  return STATUS_FLOW.map((status, index) => ({
    status,
    event: eventByStatus.get(status),
    at:
      status === 'PENDING'
        ? order.created_at
        : eventByStatus.get(status)?.created_at,
    state:
      index < currentIndex
        ? 'done'
        : index === currentIndex
          ? 'current'
          : 'next',
  }));
};

const CANCELLABLE_STATUSES = new Set(['PENDING', 'ACCEPTED']);

const OrderDetailsModal = ({
  order,
  onClose,
  nextStatus,
  nextLabel,
  onStatusChange,
  onCancel,
  updating,
}) => {
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState('');
  const [eventsUnavailable, setEventsUnavailable] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [manualEtaTime, setManualEtaTime] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const loadEvents = useCallback(async () => {
    if (!order?.id) return;
    setEventsLoading(true);
    setEventsError('');
    setEventsUnavailable(false);
    try {
      const res = await orderService.getOrderEvents(order.id);
      setEvents(extractEvents(res));
      setEventsUnavailable(false);
    } catch (error) {
      console.error('Order events fetch failed', {
        status: error?.response?.status,
        detail: error?.response?.data?.detail,
      });
      setEvents([]);
      setEventsError('');
      setEventsUnavailable(true);
    } finally {
      setEventsLoading(false);
    }
  }, [order?.id]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  if (!order) return null;

  const next = nextStatus?.[order.status];
  const etaPayload = () => {
    const manualReadyAt = buildReadyAtIso(manualEtaTime);
    if (manualReadyAt) {
      return { estimated_ready_at: manualReadyAt };
    }
    if (etaMinutes) {
      return { estimated_ready_in_minutes: etaMinutes };
    }
    return null;
  };
  const acceptingRequiresTime = next === 'ACCEPTED';
  const submitPayload = next === 'ACCEPTED' ? etaPayload() : {};
  const canSubmitNext =
    updating !== order.id && (!acceptingRequiresTime || Boolean(submitPayload));
  const stages = getOrderStages(order, events);
  const handleStatusAction = async (status, data = {}) => {
    await onStatusChange(order.id, status, data);
    await loadEvents();
  };

  const handleCancel = async () => {
    if (!onCancel) return;
    setCancelling(true);
    try {
      await onCancel(order.id, cancelReason.trim() || null);
      onClose();
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = onCancel && CANCELLABLE_STATUSES.has(order.status);

  return (
    <div
      className="modal-overlay order-details-overlay"
      style={{ zIndex: 4000 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 560,
          padding: 0,
          overflow: 'hidden',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '20px 22px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                color: 'var(--text-3)',
                fontSize: '0.74rem',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                marginBottom: 4,
              }}
            >
              Заказ #{getOrderDisplayId(order)}
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 900, margin: 0 }}>
              {order.total_price} ₽
            </h3>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={onClose}
            aria-label="Закрыть"
          >
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            padding: 22,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
              }}
            >
              <div
                style={{
                  color: 'var(--text-3)',
                  fontSize: '0.72rem',
                  marginBottom: 6,
                }}
              >
                Статус
              </div>
              <div style={{ fontWeight: 800 }}>
                {STATUS_LABEL_RU[order.status] ?? order.status}
              </div>
            </div>
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
              }}
            >
              <div
                style={{
                  color: 'var(--text-3)',
                  fontSize: '0.72rem',
                  marginBottom: 6,
                }}
              >
                Создан
              </div>
              <div style={{ fontWeight: 800 }}>
                {formatDateTime(order.created_at)}
              </div>
            </div>
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
              }}
            >
              <div
                style={{
                  color: 'var(--text-3)',
                  fontSize: '0.72rem',
                  marginBottom: 6,
                }}
              >
                К выдаче
              </div>
              <div style={{ fontWeight: 800 }}>
                {order.requested_pickup_at
                  ? formatDateTime(order.requested_pickup_at)
                  : 'Как можно скорее'}
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UserCircle size={18} color="var(--fire)" />
              <span style={{ fontWeight: 800 }}>Клиент</span>
            </div>
            {order.customer_name && (
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                {order.customer_name}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Storefront size={18} color="var(--fire)" />
              <span style={{ fontWeight: 800 }}>Заведение</span>
            </div>
            {order.restaurant_name && (
              <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>
                {order.restaurant_name}
              </div>
            )}
            {order.restaurant_address && (
              <div style={{ color: 'var(--text-2)', fontSize: '0.82rem' }}>
                {order.restaurant_address}
              </div>
            )}

            {order.estimated_ready_at && (
              <div style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
                Ожидается к: {formatDateTime(order.estimated_ready_at)}
              </div>
            )}
            {order.ready_at && (
              <div style={{ color: 'var(--text-3)', fontSize: '0.8rem' }}>
                Готов: {formatDateTime(order.ready_at)}
              </div>
            )}
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              <Package size={18} color="var(--fire)" />
              Состав заказа
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {order.items?.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800 }}>
                        {item.menu_item_name ?? item.name ?? 'Позиция'}
                      </div>
                      <div
                        style={{
                          color: 'var(--text-3)',
                          fontSize: '0.74rem',
                          marginTop: 2,
                        }}
                      >
                        {item.menu_item_category
                          ? translate(CATEGORY_RU, item.menu_item_category)
                          : '—'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 800 }}>
                      ×{item.quantity}
                      <div
                        style={{
                          color: 'var(--text-3)',
                          fontSize: '0.74rem',
                          marginTop: 2,
                        }}
                      >
                        {item.price_at_purchase} ₽
                      </div>
                    </div>
                  </div>
                  {item.selected_options?.length > 0 && (
                    <div
                      style={{
                        marginTop: 8,
                        color: 'var(--text-3)',
                        fontSize: '0.78rem',
                        lineHeight: 1.45,
                      }}
                    >
                      {item.selected_options.map(optionLabel).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
            }}
          >
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
              }}
            >
              <div style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>
                Комментарий
              </div>
              <div style={{ marginTop: 6, fontSize: '0.84rem' }}>
                {order.comment || 'Не указан'}
              </div>
            </div>
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
              }}
            >
              <div style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>
                Промокод
              </div>
              <div style={{ marginTop: 6, fontSize: '0.84rem' }}>
                {order.promo_code || 'Не сохранен'}
              </div>
            </div>
          </div>

          {next === 'ACCEPTED' && (
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: 12,
              }}
            >
              <div
                style={{
                  color: 'var(--text-3)',
                  fontSize: '0.72rem',
                  marginBottom: 8,
                }}
              >
                Время готовности
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[10, 15, 20].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={`category-chip${
                      !manualEtaTime && etaMinutes === minutes ? ' active' : ''
                    }`}
                    onClick={() => {
                      setEtaMinutes(minutes);
                      setManualEtaTime('');
                    }}
                  >
                    {minutes} мин
                  </button>
                ))}
              </div>
              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginTop: 12,
                  color: 'var(--text-3)',
                  fontSize: '0.72rem',
                }}
              >
                Указать точное время
                <input
                  type="time"
                  value={manualEtaTime}
                  onChange={(event) => {
                    setManualEtaTime(event.target.value);
                    setEtaMinutes(null);
                  }}
                  style={{
                    width: '100%',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg)',
                    color: 'var(--text-1)',
                    padding: '10px 12px',
                    font: 'inherit',
                    fontWeight: 800,
                  }}
                />
              </label>
            </div>
          )}

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              <Clock size={18} color="var(--fire)" />
              Этапы заказа
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stages.map((stage) => (
                <div
                  key={stage.status}
                  style={{
                    background:
                      stage.state === 'current'
                        ? 'rgba(255, 107, 53, 0.1)'
                        : 'var(--bg-surface)',
                    border: `1px solid ${
                      stage.state === 'current'
                        ? 'var(--fire)'
                        : 'var(--border)'
                    }`,
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    opacity: stage.state === 'next' ? 0.62 : 1,
                  }}
                >
                  <div style={{ fontSize: '0.82rem', fontWeight: 800 }}>
                    {STATUS_LABEL_RU[stage.status] ?? stage.status}
                    {stage.state === 'current' && (
                      <span
                        style={{
                          marginLeft: 8,
                          color: 'var(--fire)',
                          fontSize: '0.72rem',
                        }}
                      >
                        текущий
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      color: 'var(--text-3)',
                      fontSize: '0.72rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {stage.at ? formatDateTime(stage.at) : '—'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              <Clock size={18} color="var(--fire)" />
              Журнал изменений
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {eventsLoading && (
                <div style={{ color: 'var(--text-3)', fontSize: '0.84rem' }}>
                  Загружаю историю...
                </div>
              )}
              {eventsError && <div className="form-error">{eventsError}</div>}
              {!eventsLoading && !eventsError && eventsUnavailable && (
                <div style={{ color: 'var(--text-3)', fontSize: '0.84rem' }}>
                  История изменений пока недоступна
                </div>
              )}
              {!eventsLoading &&
                !eventsError &&
                !eventsUnavailable &&
                events.length === 0 && (
                  <div style={{ color: 'var(--text-3)', fontSize: '0.84rem' }}>
                    История появится после первого изменения статуса
                  </div>
                )}
              {events.map((event) => (
                <div
                  key={event.id}
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ fontSize: '0.82rem' }}>
                    {STATUS_LABEL_RU[event.old_status] ?? event.old_status} →{' '}
                    {STATUS_LABEL_RU[event.new_status] ?? event.new_status}
                    <div
                      style={{
                        color: 'var(--text-3)',
                        fontSize: '0.72rem',
                        marginTop: 2,
                      }}
                    >
                      {permissionPresetLabel(event.actor_permissions)}
                    </div>
                  </div>
                  <div
                    style={{
                      color: 'var(--text-3)',
                      fontSize: '0.72rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {formatDateTime(event.created_at)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {(next || canCancel) && (
          <div
            style={{
              padding: '14px 22px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {showCancelForm ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <textarea
                  className="form-input"
                  placeholder="Причина отмены (необязательно)"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={2}
                  style={{ resize: 'none', fontSize: '0.85rem' }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowCancelForm(false)}
                    disabled={cancelling}
                    style={{ flex: 1 }}
                  >
                    Назад
                  </button>
                  <button
                    className="btn"
                    onClick={handleCancel}
                    disabled={cancelling}
                    style={{
                      flex: 1,
                      background: '#ef4444',
                      color: '#fff',
                      border: 'none',
                    }}
                  >
                    {cancelling ? '...' : 'Подтвердить отмену'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                {canCancel && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowCancelForm(true)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  >
                    <XCircle size={16} />
                    Отменить
                  </button>
                )}
                {next && (
                  <button
                    className="btn btn-primary"
                    disabled={!canSubmitNext}
                    onClick={() => handleStatusAction(next, submitPayload)}
                    style={{ flex: 1 }}
                  >
                    {updating === order.id
                      ? '...'
                      : nextLabel?.[order.status] || 'Дальше'}
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderDetailsModal;
