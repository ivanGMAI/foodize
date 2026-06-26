import { useState, useEffect, useRef } from 'react';
import { Bell, Trash } from '@phosphor-icons/react';
import { notificationService } from '../../services/notificationService';
import { createNotificationWebSocket } from '../../services/api';
import { useAuthStore } from '../../store/useAuthStore';
import { useShallow } from 'zustand/react/shallow';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const getDateStart = (date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

const getDayLabel = (value) => {
  if (!value) return 'Недавно';
  const date = new Date(value);
  if (isNaN(date.getTime())) return 'Недавно';
  const today = getDateStart(new Date());
  const day = getDateStart(date);
  const diff = Math.round((today - day) / MS_PER_DAY);

  if (diff <= 0) return 'Сегодня';
  if (diff === 1) return 'Вчера';
  if (diff === 2) return '2 дня назад';
  if (diff < 5) return `${diff} дня назад`;
  return `${diff} дней назад`;
};

const groupNotificationsByDay = (items) => {
  const sorted = [...items].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at)
  );

  return sorted.reduce((groups, notification) => {
    const label = getDayLabel(notification.created_at);
    const last = groups[groups.length - 1];

    if (last?.label === label) {
      last.items.push(notification);
    } else {
      groups.push({ label, items: [notification] });
    }

    return groups;
  }, []);
};

const NotificationBell = () => {
  const { user, isAuthenticated } = useAuthStore(
    useShallow((s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }))
  );

  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const wsRef = useRef(null);
  const notificationGroups = groupNotificationsByDay(notifications);

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    // Fetch initial notifications
    notificationService
      .getNotifications({ page: 1, size: 20 })
      .then((res) => {
        setNotifications(res.data.items || []);
        setUnreadCount(res.data.unread_count || 0);
        setTotal(res.data.total || 0);
        setPage(1);
      })
      .catch(() => {});

    // Open WebSocket
    wsRef.current = createNotificationWebSocket(user.id, (msg) => {
      if (!msg?.id) return;
      setNotifications((prev) => [msg, ...prev]);
      setUnreadCount((c) => c + 1);
    });

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {}
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {}
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    const notification = notifications.find((n) => n.id === id);
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (notification && !notification.is_read) {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {}
  };

  const handleDeleteAll = async () => {
    try {
      await notificationService.deleteAll();
      setNotifications([]);
      setUnreadCount(0);
      setTotal(0);
      setPage(1);
    } catch {}
  };

  const handleLoadMore = async () => {
    if (loadingMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await notificationService.getNotifications({
        page: nextPage,
        size: 20,
      });
      setNotifications((prev) => [...prev, ...(res.data.items || [])]);
      setTotal(res.data.total || 0);
      setPage(nextPage);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div style={{ position: 'relative' }} ref={dropdownRef}>
      <button
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          position: 'relative',
          padding: 8,
          color: 'var(--text-1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Уведомления"
      >
        <Bell size={20} weight={unreadCount > 0 ? 'fill' : 'bold'} />
        {unreadCount > 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: 'var(--fire)',
              color: 'var(--fire-text)',
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--weight-display)',
              padding: '2px 5px',
              borderRadius: '10px',
              lineHeight: 1,
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            width: 320,
            maxHeight: 400,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            marginTop: 8,
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg-surface)',
            }}
          >
            <span
              style={{
                fontWeight: 800,
                fontSize: '0.95rem',
                color: 'var(--text-1)',
              }}
            >
              Уведомления
            </span>
            {notifications.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    Прочитать все
                  </button>
                )}
                <button
                  onClick={handleDeleteAll}
                  aria-label="Удалить все уведомления"
                  title="Удалить все"
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 'var(--r-xs)',
                    border: '1px solid var(--border)',
                    background: 'var(--bg-card)',
                    color: 'var(--text-3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <Trash size={14} weight="bold" />
                </button>
              </div>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  textAlign: 'center',
                  color: 'var(--text-3)',
                  fontSize: '0.875rem',
                }}
              >
                Нет уведомлений
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {notificationGroups.map((group) => (
                  <div key={group.label}>
                    <div
                      style={{
                        padding: '10px 16px 6px',
                        color: 'var(--text-3)',
                        fontSize: '0.72rem',
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        background: 'var(--bg-surface)',
                        borderBottom: '1px solid var(--border)',
                      }}
                    >
                      {group.label}
                    </div>
                    {group.items.map((n) => (
                      <div
                        key={n.id}
                        onClick={(e) => !n.is_read && handleMarkAsRead(n.id, e)}
                        style={{
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border)',
                          background: n.is_read
                            ? 'transparent'
                            : 'var(--brand-alpha)',
                          cursor: n.is_read ? 'default' : 'pointer',
                          transition: 'background 0.2s',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: 4,
                            gap: 8,
                          }}
                        >
                          <strong
                            style={{
                              fontSize: '0.875rem',
                              color: 'var(--text-1)',
                              lineHeight: 1.2,
                            }}
                          >
                            {n.title}
                          </strong>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--text-3)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {n.created_at && !isNaN(new Date(n.created_at))
                                ? new Date(n.created_at).toLocaleTimeString(
                                    'ru-RU',
                                    { hour: '2-digit', minute: '2-digit' }
                                  )
                                : ''}
                            </span>
                            <button
                              onClick={(e) => handleDelete(n.id, e)}
                              aria-label="Удалить уведомление"
                              title="Удалить"
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: 'var(--r-xs)',
                                border: '1px solid var(--border)',
                                background: 'var(--bg-surface)',
                                color: 'var(--text-3)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Trash size={12} weight="bold" />
                            </button>
                          </div>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.8rem',
                            color: 'var(--text-2)',
                            lineHeight: 1.4,
                          }}
                        >
                          {n.message}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
                {notifications.length < total && (
                  <button
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      background: 'none',
                      border: 'none',
                      borderTop: '1px solid var(--border)',
                      color: 'var(--brand)',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: loadingMore ? 'default' : 'pointer',
                      opacity: loadingMore ? 0.6 : 1,
                    }}
                  >
                    {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
