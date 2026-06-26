import { useEffect, useState, useCallback } from 'react';
import {
  ChartLineUp,
  UsersThree,
  Package,
  Storefront,
  Trash,
  X,
  Star,
  UserCircle,
  Clock,
  CheckCircle,
  HandPalm,
  CaretDown,
  Rows,
  Prohibit,
  Monitor,
  ShieldWarning,
  QrCode,
} from '@phosphor-icons/react';
import { useDebounce } from '../../hooks/useDebounce';
import { adminService } from '../../services/adminService';
import EmptyState from '../../components/ui/EmptyState';
import OrderDetailsModal from '../../components/ui/OrderDetailsModal';
import QRCodeModal from '../../components/ui/QRCodeModal';
import Pagination from '../../components/ui/Pagination';
import { useModalStore } from '../../store/useModalStore';
import { useAuthStore } from '../../store/useAuthStore';
import {
  RevenueChart,
  HourlyLoadChart,
  CategoryRevenueChart,
  AOVDynamicsChart,
  UsersByRoleChart,
  KPICards,
  TopItemsChart,
  TopRestaurantsChart,
  OrderStatusPieChart,
} from '../../components/dashboard/DashboardCharts';
import {
  ORDER_STATUS_RU,
  APPROVAL_STATUS_RU,
  CATEGORY_RU,
  translate,
} from '../../utils/locales';
import {
  ADMIN_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
  hasPermission,
  PERMISSION_PRESET_RU,
  PERMISSION_PRESETS,
  permissionPresetLabel,
  PERMISSIONS,
} from '../../utils/permissions';
import { downloadBlob } from '../../utils/download';

const PAGE_SIZE = 20;

const AUDIT_ACTION_LABELS = {
  APPROVE_VENDOR: 'Одобрен вендор',
  REJECT_VENDOR: 'Отклонён вендор',
  DEACTIVATE_VENDOR: 'Деактивирован вендор',
  APPROVE_RESTAURANT: 'Одобрен ресторан',
  REJECT_RESTAURANT: 'Отклонён ресторан',
  DEACTIVATE_USER: 'Деактивирован пользователь',
  ACTIVATE_USER: 'Активирован пользователь',
  UPDATE_PERMISSIONS: 'Изменены права пользователя',
  CREATE_MENU_ITEM: 'Создан пункт меню',
  UPDATE_MENU_ITEM: 'Изменён пункт меню',
  DELETE_MENU_ITEM: 'Удалён пункт меню',
  TOGGLE_MENU_ITEM: 'Изменена доступность пункта меню',
  CREATE_PROMO: 'Создан промокод',
  DEACTIVATE_PROMO: 'Деактивирован промокод',
  FORCE_CANCEL_ORDER: 'Заказ отменён администратором',
  DELETE_REVIEW: 'Удален отзыв',
};

const AnalyticsSkeleton = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="skeleton"
          style={{ height: 92, borderRadius: 'var(--radius-md)' }}
        />
      ))}
    </div>
    <div
      className="skeleton"
      style={{ height: 260, borderRadius: 'var(--radius-md)' }}
    />
  </div>
);

const STATUS_MAP = {
  PENDING: {
    label: ORDER_STATUS_RU.PENDING,
    className: 'pending',
    icon: <Clock />,
  },
  ACCEPTED: {
    label: ORDER_STATUS_RU.ACCEPTED,
    className: 'pending',
    icon: <CheckCircle />,
  },
  READY: {
    label: ORDER_STATUS_RU.READY,
    className: 'ready',
    icon: <HandPalm />,
  },
  COMPLETED: {
    label: ORDER_STATUS_RU.COMPLETED,
    className: 'ready',
    icon: <CheckCircle weight="fill" />,
  },
};

const formatDateTime = (value) => {
  if (!value) return '—';
  return new Date(value).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const shortId = (value) => (value ? value.slice(0, 8) : '—');
const orderTitle = (order) => order.display_id ?? shortId(order.id);

const cardStyle = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-md)',
  boxShadow: 'var(--shadow-sm)',
};

const filterGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 8,
  alignItems: 'center',
};

const wideFilterGridStyle = {
  ...filterGridStyle,
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
};

const filterControlStyle = {
  minWidth: 0,
  height: 48,
  paddingTop: 11,
  paddingBottom: 11,
  fontSize: '0.86rem',
  lineHeight: 1.2,
};

const selectFilterStyle = {
  ...filterControlStyle,
  paddingRight: 34,
  backgroundPosition: 'right 10px center',
};

const DetailField = ({ label, children, mono = false }) => (
  <div
    style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--r-sm)',
      padding: 12,
      minWidth: 0,
    }}
  >
    <div
      style={{
        color: 'var(--text-3)',
        fontSize: '0.7rem',
        fontWeight: 800,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div
      style={{
        color: 'var(--text-1)',
        fontWeight: 800,
        fontSize: mono ? '0.78rem' : '0.9rem',
        fontFamily: mono ? 'monospace' : 'inherit',
        overflowWrap: 'anywhere',
      }}
    >
      {children ?? '—'}
    </div>
  </div>
);

const DetailModal = ({ title, subtitle, onClose, loading, children }) => (
  <div
    className="modal-overlay"
    onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <div
      className="modal-content"
      style={{
        maxWidth: 620,
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
          gap: 16,
        }}
      >
        <div>
          <div
            style={{
              color: 'var(--text-3)',
              fontSize: '0.78rem',
              fontWeight: 800,
            }}
          >
            {subtitle}
          </div>
          <h3
            style={{
              margin: '4px 0 0',
              color: 'var(--text-1)',
              fontSize: '1.18rem',
            }}
          >
            {title}
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
      <div style={{ padding: 22, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              className="skeleton"
              style={{ width: '100%', height: 24, borderRadius: 4 }}
            />
            <div
              className="skeleton"
              style={{ width: '80%', height: 16, borderRadius: 4 }}
            />
            <div
              className="skeleton"
              style={{ width: '90%', height: 16, borderRadius: 4 }}
            />
            <div
              className="skeleton"
              style={{ width: '60%', height: 16, borderRadius: 4 }}
            />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  </div>
);

const ReasonDialog = ({ dialog, loading, onCancel, onConfirm }) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    setReason('');
  }, [dialog]);

  if (!dialog) return null;

  const trimmedReason = reason.trim();

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 5000 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading) onCancel();
      }}
    >
      <div
        className="modal-content"
        style={{
          maxWidth: 480,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div>
          <h3
            style={{ color: 'var(--text-1)', fontSize: '1.05rem', margin: 0 }}
          >
            {dialog.title}
          </h3>
          <p
            style={{
              color: 'var(--text-3)',
              fontSize: '0.88rem',
              lineHeight: 1.55,
              margin: '8px 0 0',
            }}
          >
            {dialog.message}
          </p>
        </div>

        <textarea
          className="form-input"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Напишите причину отклонения"
          rows={4}
          style={{ minHeight: 112, resize: 'vertical' }}
          autoFocus
        />

        <div
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          }}
        >
          <button
            className="btn btn-secondary"
            disabled={loading}
            onClick={onCancel}
          >
            Отмена
          </button>
          <button
            className="btn btn-primary"
            disabled={loading || !trimmedReason}
            onClick={() => onConfirm(trimmedReason)}
            style={{ background: 'var(--error)' }}
          >
            {loading ? 'Выполняю...' : dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const sumValues = (valueMap = {}) =>
  Object.values(valueMap).reduce((a, b) => a + b, 0);

const Sparkline = ({ points = [], color = 'var(--fire)' }) => {
  const values = points.map((point) => point.count || 0);
  const max = Math.max(...values, 1);
  const width = 220;
  const height = 76;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const line = values
    .map((value, index) => {
      const x = index * step;
      const y = height - 10 - (value / max) * (height - 20);
      return `${x},${y}`;
    })
    .join(' ');
  const area = line ? `0,${height} ${line} ${width},${height}` : '';

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-hidden="true"
      style={{ width: '100%', height: 76, display: 'block', marginTop: 14 }}
    >
      <polyline points={area} fill="rgba(255, 107, 53, 0.1)" stroke="none" />
      <polyline
        points={line}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {values.map((value, index) => {
        const x = index * step;
        const y = height - 10 - (value / max) * (height - 20);
        return (
          <circle key={`${index}-${value}`} cx={x} cy={y} r="3" fill={color} />
        );
      })}
    </svg>
  );
};

const StatCard = ({ label, value, icon, growth, onClick }) => {
  const totalGrowth = (growth || []).reduce(
    (sum, point) => sum + (point.count || 0),
    0
  );

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...cardStyle,
        padding: 18,
        textAlign: 'left',
        width: '100%',
        minHeight: 190,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
      >
        <div>
          <div
            style={{
              color: 'var(--text-3)',
              fontSize: '0.72rem',
              fontWeight: 900,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {label}
          </div>
          <div
            style={{
              color: 'var(--text-1)',
              fontSize: '2rem',
              fontWeight: 950,
              lineHeight: 1.1,
              marginTop: 8,
            }}
          >
            {value}
          </div>
        </div>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 'var(--r-sm)',
            background: 'var(--fire-subtle)',
            color: 'var(--fire)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
      <Sparkline points={growth} />
      <div
        style={{ color: 'var(--text-3)', fontSize: '0.78rem', fontWeight: 700 }}
      >
        +{totalGrowth} за последние 14 дней
      </div>
    </button>
  );
};

const AdminDashboardPage = () => {
  const { user: currentUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const [users, setUsers] = useState([]);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetailsLoading, setUserDetailsLoading] = useState(false);
  const [permissionActionLoading, setPermissionActionLoading] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [restaurants, setRestaurants] = useState([]);
  const [restaurantsPage, setRestaurantsPage] = useState(1);
  const [restaurantsTotal, setRestaurantsTotal] = useState(0);
  const [restaurantsLoading, setRestaurantsLoading] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [restaurantDetailsLoading, setRestaurantDetailsLoading] =
    useState(false);

  const [vendors, setVendors] = useState([]);
  const [vendorsPage, setVendorsPage] = useState(1);
  const [vendorsTotal, setVendorsTotal] = useState(0);
  const [vendorsLoading, setVendorsLoading] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [vendorDetailsLoading, setVendorDetailsLoading] = useState(false);

  const [reviews, setReviews] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [allRestaurants, setAllRestaurants] = useState([]);
  const [finance, setFinance] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeFilters, setFinanceFilters] = useState({
    date_from: '',
    date_to: '',
    restaurant_id: '',
  });
  const [activePreset, setActivePreset] = useState(null);

  const [advancedAnalytics, setAdvancedAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [userFilters, setUserFilters] = useState({ role: '' });
  const [userSearchRaw, setUserSearchRaw] = useState('');
  const userSearch = useDebounce(userSearchRaw);

  const [orderFilters, setOrderFilters] = useState({
    status: '',
    date_from: '',
    date_to: '',
  });
  const [orderSearchRaw, setOrderSearchRaw] = useState('');
  const orderSearch = useDebounce(orderSearchRaw);

  const [restaurantFilters, setRestaurantFilters] = useState({
    is_open: '',
    moderation_status: '',
    min_rating: '',
  });
  const [restaurantSearchRaw, setRestaurantSearchRaw] = useState('');
  const restaurantSearch = useDebounce(restaurantSearchRaw);
  const [restaurantVendorSearchRaw, setRestaurantVendorSearchRaw] =
    useState('');
  const restaurantVendorSearch = useDebounce(restaurantVendorSearchRaw);

  const [vendorFilters, setVendorFilters] = useState({ approval_status: '' });
  const [vendorSearchRaw, setVendorSearchRaw] = useState('');
  const vendorSearch = useDebounce(vendorSearchRaw);
  const [reviewFilters, setReviewFilters] = useState({ rating: '' });
  const [reasonDialog, setReasonDialog] = useState(null);
  const [reasonLoading, setReasonLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [selectedVendorIds, setSelectedVendorIds] = useState(new Set());
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState(new Set());
  const [qrRestaurant, setQrRestaurant] = useState(null);
  const [qrType, setQrType] = useState('site');
  const [selectedUserIds, setSelectedUserIds] = useState(new Set());
  const [selectedReviewIds, setSelectedReviewIds] = useState(new Set());
  const [batchLoading, setBatchLoading] = useState(false);
  const [entitiesOpen, setEntitiesOpen] = useState(true);

  useEffect(() => {
    if (
      ['users', 'orders', 'restaurants', 'vendors', 'reviews'].includes(
        activeTab
      )
    ) {
      setEntitiesOpen(true);
    }
  }, [activeTab]);

  const [auditLogs, setAuditLogs] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    entity_type: '',
    date_from: '',
    date_to: '',
  });
  const [expandedAuditId, setExpandedAuditId] = useState(null);

  const requestConfirm = useModalStore((s) => s.requestConfirm);
  const requestReason = (dialog) => setReasonDialog(dialog);

  const runReasonAction = async (reason) => {
    if (!reasonDialog?.onConfirm) return;
    setReasonLoading(true);
    try {
      await reasonDialog.onConfirm(reason);
      setReasonDialog(null);
    } finally {
      setReasonLoading(false);
    }
  };

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const getRestaurantLabel = () => {
    if (!financeFilters.restaurant_id) return 'все';
    return (
      allRestaurants.find((r) => r.id === financeFilters.restaurant_id)?.name ||
      'все'
    ).replace(/\s+/g, '_');
  };

  const getDateRangeLabel = () => {
    const from = financeFilters.date_from || todayStr;
    const to = financeFilters.date_to || todayStr;
    return `${from}_${to}`;
  };

  const handleExport = async (exportFn, filename) => {
    setExportLoading(true);
    try {
      const res = await exportFn();
      downloadBlob(res.data, filename);
    } catch {
      setActionError('Не удалось выполнить экспорт');
    } finally {
      setExportLoading(false);
    }
  };

  const handleBatchVendors = async (action, reason) => {
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedVendorIds);
      if (action === 'approve') {
        await adminService.batchApproveVendors(ids);
      } else {
        await adminService.batchRejectVendors(ids, reason);
      }
      setSelectedVendorIds(new Set());
      setActionSuccess(`Готово: ${ids.length} вендоров`);
      setVendorsPage(1);
      setVendorFilters((f) => ({ ...f }));
    } catch {
      setActionError('Ошибка при массовом действии');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchRestaurants = async (action, reason) => {
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedRestaurantIds);
      if (action === 'approve') {
        await adminService.batchApproveRestaurants(ids);
      } else {
        await adminService.batchRejectRestaurants(ids, reason);
      }
      setSelectedRestaurantIds(new Set());
      setActionSuccess(`Готово: ${ids.length} ресторанов`);
      setRestaurantsPage(1);
      setRestaurantFilters((f) => ({ ...f }));
    } catch {
      setActionError('Ошибка при массовом действии');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchUsers = async (action) => {
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedUserIds);
      if (action === 'deactivate') await adminService.batchDeactivateUsers(ids);
      else await adminService.batchActivateUsers(ids);
      setSelectedUserIds(new Set());
      setActionSuccess(`Готово: ${ids.length} пользователей`);
      setUsersPage(1);
      setUserFilters((f) => ({ ...f }));
    } catch {
      setActionError('Ошибка при массовом действии');
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchDeleteReviews = async () => {
    setBatchLoading(true);
    try {
      const ids = Array.from(selectedReviewIds);
      await adminService.batchDeleteReviews(ids);
      setSelectedReviewIds(new Set());
      setActionSuccess(`Удалено: ${ids.length} отзывов`);
      setReviewsPage(1);
      setReviewFilters((f) => ({ ...f }));
    } catch {
      setActionError('Ошибка при удалении');
    } finally {
      setBatchLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'stats' && !stats) {
      adminService
        .getPlatformStats()
        .then((res) => setStats(res.data.data))
        .catch(() => setActionError('Не удалось загрузить статистику'));
    }
  }, [activeTab, stats]);

  useEffect(() => {
    if (activeTab !== 'users') return;
    setUsersLoading(true);
    adminService
      .getUsers({
        page: usersPage,
        size: PAGE_SIZE,
        search: userSearch || undefined,
        role: userFilters.role || undefined,
      })
      .then((res) => {
        setUsers(res.data.data || []);
        setUsersTotal(res.data.pagination?.total || 0);
      })
      .catch(() => setActionError('Не удалось загрузить пользователей'))
      .finally(() => setUsersLoading(false));
  }, [activeTab, usersPage, userFilters, userSearch]);

  useEffect(() => {
    if (activeTab !== 'orders') return;
    setOrdersLoading(true);
    adminService
      .getOrders({
        page: ordersPage,
        size: PAGE_SIZE,
        status: orderFilters.status || undefined,
        search: orderSearch || undefined,
        date_from: orderFilters.date_from || undefined,
        date_to: orderFilters.date_to || undefined,
      })
      .then((res) => {
        setOrders(res.data.data || []);
        setOrdersTotal(res.data.pagination?.total || 0);
      })
      .catch(() => setActionError('Не удалось загрузить заказы'))
      .finally(() => setOrdersLoading(false));
  }, [activeTab, ordersPage, orderFilters, orderSearch]);

  useEffect(() => {
    if (activeTab !== 'restaurants') return;
    setRestaurantsLoading(true);
    adminService
      .getRestaurants({
        page: restaurantsPage,
        size: PAGE_SIZE,
        search: restaurantSearch || undefined,
        vendor_search: restaurantVendorSearch || undefined,
        is_open: restaurantFilters.is_open || undefined,
        moderation_status: restaurantFilters.moderation_status || undefined,
        min_rating: restaurantFilters.min_rating || undefined,
      })
      .then((res) => {
        setRestaurants(res.data.data || []);
        setRestaurantsTotal(res.data.pagination?.total || 0);
      })
      .catch(() => setActionError('Не удалось загрузить рестораны'))
      .finally(() => setRestaurantsLoading(false));
  }, [
    activeTab,
    restaurantsPage,
    restaurantFilters,
    restaurantSearch,
    restaurantVendorSearch,
  ]);

  useEffect(() => {
    if (activeTab !== 'vendors') return;
    setVendorsLoading(true);
    adminService
      .getVendors({
        page: vendorsPage,
        size: PAGE_SIZE,
        search: vendorSearch || undefined,
        approval_status: vendorFilters.approval_status || undefined,
      })
      .then((res) => {
        setVendors(res.data.data || []);
        setVendorsTotal(res.data.pagination?.total || 0);
      })
      .catch(() => setActionError('Не удалось загрузить вендоров'))
      .finally(() => setVendorsLoading(false));
  }, [activeTab, vendorsPage, vendorFilters, vendorSearch]);

  useEffect(() => {
    if (activeTab !== 'reviews') return;
    setReviewsLoading(true);
    adminService
      .getReviews({
        page: reviewsPage,
        size: PAGE_SIZE,
        rating: reviewFilters.rating || undefined,
      })
      .then((res) => {
        setReviews(res.data.data || []);
        setReviewsTotal(res.data.pagination?.total || 0);
      })
      .catch(() => setActionError('Не удалось загрузить отзывы'))
      .finally(() => setReviewsLoading(false));
  }, [activeTab, reviewsPage, reviewFilters]);

  const fetchFinance = useCallback(async () => {
    setFinanceLoading(true);
    setAnalyticsLoading(true);
    try {
      const params = Object.fromEntries(
        Object.entries(financeFilters).filter(([, v]) => v !== '' && v != null)
      );
      const [finRes, advRes] = await Promise.all([
        adminService.getFinance(params),
        adminService.getAdvancedAnalytics(params),
      ]);
      setFinance(finRes.data.data);
      setAdvancedAnalytics(advRes.data.data);
    } catch {
      setActionError('Не удалось загрузить аналитику');
    } finally {
      setFinanceLoading(false);
      setAnalyticsLoading(false);
    }
  }, [financeFilters]);

  useEffect(() => {
    if (activeTab === 'finance') {
      fetchFinance();
      if (allRestaurants.length === 0) {
        adminService
          .getRestaurants({ size: 100 })
          .then((res) => setAllRestaurants(res.data.data || []));
      }
    }
  }, [activeTab, fetchFinance, allRestaurants.length]);

  useEffect(() => {
    if (activeTab !== 'audit') return;
    setAuditLoading(true);
    const params = {
      page: auditPage,
      size: PAGE_SIZE,
      ...(auditFilters.action && { action: auditFilters.action }),
      ...(auditFilters.entity_type && {
        entity_type: auditFilters.entity_type,
      }),
      ...(auditFilters.date_from && { date_from: auditFilters.date_from }),
      ...(auditFilters.date_to && { date_to: auditFilters.date_to }),
    };
    adminService
      .getAuditLogs(params)
      .then((res) => {
        setAuditLogs(res.data.data || []);
        setAuditTotal(res.data.pagination?.total || 0);
      })
      .catch(() => setActionError('Не удалось загрузить логи'))
      .finally(() => setAuditLoading(false));
  }, [activeTab, auditPage, auditFilters]);

  const loadUserDetails = async (id) => {
    setUserDetailsLoading(true);
    setActionError('');
    try {
      const res = await adminService.getUser(id);
      setSelectedUser(res.data.data);
    } catch {
      setActionError('Не удалось загрузить детали пользователя');
    } finally {
      setUserDetailsLoading(false);
    }
  };

  const loadRestaurantDetails = async (id) => {
    setRestaurantDetailsLoading(true);
    setActionError('');
    try {
      const res = await adminService.getRestaurant(id);
      setSelectedRestaurant(res.data.data);
    } catch {
      setActionError('Не удалось загрузить детали ресторана');
    } finally {
      setRestaurantDetailsLoading(false);
    }
  };

  const loadVendorDetails = async (id) => {
    setVendorDetailsLoading(true);
    setActionError('');
    try {
      const res = await adminService.getVendor(id);
      setSelectedVendor(res.data.data);
    } catch {
      setActionError('Не удалось загрузить детали вендора');
    } finally {
      setVendorDetailsLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    requestConfirm({
      title: 'Заблокировать пользователя?',
      message:
        'Пользователь больше не сможет пользоваться аккаунтом, пока вы его не разблокируете.',
      confirmLabel: 'Заблокировать',
      danger: true,
      onConfirm: async () => {
        setActionError('');
        try {
          await adminService.deleteUser(id);
          setUsers((prev) =>
            prev.map((u) => (u.id === id ? { ...u, is_active: false } : u))
          );
          setSelectedUser((prev) =>
            prev?.id === id ? { ...prev, is_active: false } : prev
          );
        } catch {
          setActionError('Не удалось заблокировать пользователя');
        }
      },
    });
  };

  const handleMakeAdmin = async (userId) => {
    requestConfirm({
      title: 'Сделать пользователя админом?',
      message:
        'Точно ли вы хотите дать этому пользователю права администратора?',
      confirmLabel: 'Сделать админом',
      onConfirm: async () => {
        setPermissionActionLoading(true);
        setActionError('');
        try {
          await adminService.grantAdmin(userId);
          setSelectedUser((prev) =>
            prev ? { ...prev, permissions: ADMIN_PERMISSIONS } : prev
          );
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId ? { ...u, permissions: ADMIN_PERMISSIONS } : u
            )
          );
        } catch {
          setActionError('Не удалось изменить роль');
        } finally {
          setPermissionActionLoading(false);
        }
      },
    });
  };

  const handleSetPermissionPreset = async (userId, preset) => {
    const permissions = PERMISSION_PRESETS[preset] || CUSTOMER_PERMISSIONS;
    requestConfirm({
      title: `Set permissions preset: ${PERMISSION_PRESET_RU[preset]}?`,
      message: `Replace this user's permissions with ${PERMISSION_PRESET_RU[preset]} preset?`,
      confirmLabel: 'Изменить',
      onConfirm: async () => {
        setPermissionActionLoading(true);
        setActionError('');
        try {
          await adminService.setPermissions(userId, permissions);
          setSelectedUser((prev) => (prev ? { ...prev, permissions } : prev));
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, permissions } : u))
          );
        } catch {
          setActionError('Не удалось изменить роль');
        } finally {
          setPermissionActionLoading(false);
        }
      },
    });
  };

  const handleDeleteRestaurant = async (restaurantId) => {
    requestConfirm({
      title: 'Удалить ресторан?',
      message:
        'Точно ли вы хотите удалить ресторан? Он пропадёт из активных списков и будет закрыт.',
      confirmLabel: 'Удалить ресторан',
      danger: true,
      onConfirm: async () => {
        setActionError('');
        try {
          await adminService.deleteRestaurant(restaurantId);
          setRestaurants((prev) =>
            prev.filter((item) => item.id !== restaurantId)
          );
          setSelectedRestaurant(null);
          setStats(null);
        } catch {
          setActionError('Не удалось удалить ресторан');
        }
      },
    });
  };

  const handleDeleteVendor = async (vendorId) => {
    requestConfirm({
      title: 'Удалить вендора?',
      message:
        'Точно ли вы хотите удалить вендора? Его рестораны будут скрыты.',
      confirmLabel: 'Удалить вендора',
      danger: true,
      onConfirm: async () => {
        setActionError('');
        try {
          await adminService.deleteVendor(vendorId);
          setVendors((prev) => prev.filter((item) => item.id !== vendorId));
          setSelectedVendor(null);
          setStats(null);
        } catch {
          setActionError('Не удалось удалить вендора');
        }
      },
    });
  };

  const handleDeleteReview = async (reviewId) => {
    requestConfirm({
      title: 'Удалить отзыв?',
      message:
        'Точно ли вы хотите удалить отзыв? Он исчезнет из карточки ресторана.',
      confirmLabel: 'Удалить отзыв',
      danger: true,
      onConfirm: async () => {
        setActionError('');
        try {
          await adminService.deleteReview(reviewId);
          setReviews((prev) => prev.filter((item) => item.id !== reviewId));
          setReviewsTotal((prev) => Math.max(0, prev - 1));
        } catch {
          setActionError('Не удалось удалить отзыв');
        }
      },
    });
  };

  const refreshSelectedRestaurant = (data) => {
    setSelectedRestaurant(data);
    setRestaurants((prev) =>
      prev.map((item) => (item.id === data.id ? data : item))
    );
  };

  const refreshSelectedVendor = (data) => {
    setSelectedVendor(data);
    setVendors((prev) =>
      prev.map((item) => (item.id === data.id ? data : item))
    );
  };

  const showActionSuccess = (message) => {
    setActionError('');
    setActionSuccess(message);
    window.setTimeout(() => setActionSuccess(''), 4000);
  };

  const handleApproveRestaurant = async (restaurantId) => {
    try {
      const res = await adminService.approveRestaurant(restaurantId);
      refreshSelectedRestaurant(res.data.data);
      showActionSuccess('Ресторан одобрен');
    } catch {
      setActionError('Не удалось одобрить ресторан');
    }
  };

  const handleRejectRestaurant = (restaurantId) => {
    requestReason({
      title: 'Отклонить ресторан',
      message:
        'Укажите причину. Вендор увидит, что нужно исправить перед повторной проверкой.',
      confirmLabel: 'Отклонить',
      onConfirm: async (reason) => {
        try {
          const res = await adminService.rejectRestaurant(restaurantId, reason);
          refreshSelectedRestaurant(res.data.data);
          showActionSuccess('Ресторан отклонён');
        } catch {
          setActionError('Не удалось отклонить ресторан');
        }
      },
    });
  };

  const handleApproveVendor = (vendorId) => {
    requestConfirm({
      title: 'Одобрить вендора?',
      message:
        'После одобрения вендор сможет работать в кабинете и управлять заведениями.',
      confirmLabel: 'Одобрить',
      onConfirm: async () => {
        setActionError('');
        setActionSuccess('');
        try {
          const res = await adminService.approveVendor(vendorId);
          refreshSelectedVendor(res.data.data);
          showActionSuccess('Вендор одобрен');
        } catch {
          setActionError('Не удалось одобрить вендора');
        }
      },
    });
  };

  const handleRejectVendor = (vendorId) => {
    requestReason({
      title: 'Отклонить вендора',
      message:
        'Укажите причину отказа, чтобы заявка не выглядела как молчаливый отказ.',
      confirmLabel: 'Отклонить',
      onConfirm: async (reason) => {
        try {
          const res = await adminService.rejectVendor(vendorId, reason);
          refreshSelectedVendor(res.data.data);
          showActionSuccess('Вендор отклонён');
        } catch {
          setActionError('Не удалось отклонить вендора');
        }
      },
    });
  };

  const handleActivateUser = async (userId) => {
    setPermissionActionLoading(true);
    setActionError('');
    try {
      await adminService.activateUser(userId);
      setSelectedUser((prev) => (prev ? { ...prev, is_active: true } : prev));
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: true } : u))
      );
    } catch {
      setActionError('Не удалось разблокировать пользователя');
    } finally {
      setPermissionActionLoading(false);
    }
  };

  const tabs = [
    { id: 'stats', label: 'Статистика', icon: <ChartLineUp size={18} /> },
    { id: 'users', label: 'Пользователи', icon: <UsersThree size={18} /> },
    { id: 'orders', label: 'Заказы', icon: <Package size={18} /> },
    { id: 'resolution', label: 'Модерация', icon: <ShieldWarning size={18} /> },
    { id: 'restaurants', label: 'Рестораны', icon: <Storefront size={18} /> },
    { id: 'vendors', label: 'Вендоры', icon: <UsersThree size={18} /> },
    { id: 'reviews', label: 'Отзывы', icon: <Star size={18} /> },
    { id: 'finance', label: 'Аналитика', icon: <ChartLineUp size={18} /> },
    { id: 'audit', label: 'Логи', icon: <Clock size={18} /> },
  ];

  const ENTITY_TAB_IDS = new Set([
    'users',
    'orders',
    'restaurants',
    'vendors',
    'reviews',
  ]);

  const renderTabButton = (tab, indented = false) => (
    <button
      key={tab.id}
      className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
      onClick={() => setActiveTab(tab.id)}
      style={{
        justifyContent: 'flex-start',
        border: 'none',
        padding: indented ? '8px 16px' : '10px 16px',
        gap: 10,
        fontSize: indented ? '0.88rem' : '0.95rem',
        fontWeight: activeTab === tab.id ? 700 : 500,
      }}
    >
      {tab.icon}
      {tab.label}
    </button>
  );

  return (
    <div
      className="page-enter"
      style={{
        padding: '80px 20px 100px',
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        gap: 24,
        alignItems: 'flex-start',
      }}
    >
      <div
        className="admin-sidebar"
        style={{
          width: 240,
          flexShrink: 0,
          position: 'sticky',
          top: 80,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          background: 'var(--bg-card)',
          padding: 16,
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--border)',
        }}
      >
        <h1 style={{ fontSize: '1.2rem', fontWeight: 900, marginBottom: 16 }}>
          Админ-панель
        </h1>
        {tabs
          .filter((t) => t.id === 'stats')
          .map((tab) => renderTabButton(tab))}
        <div>
          <button
            onClick={() => setEntitiesOpen((o) => !o)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 14px',
              background: entitiesOpen ? 'var(--bg-surface)' : 'none',
              border: '1px solid',
              borderColor: entitiesOpen ? 'var(--border)' : 'transparent',
              cursor: 'pointer',
              color: 'var(--text-2)',
              fontSize: '0.9rem',
              fontWeight: 700,
              borderRadius: 'var(--r-sm)',
              marginTop: 4,
              transition: 'background 0.15s, border-color 0.15s',
            }}
          >
            <Rows size={16} weight="bold" />
            Сущности
            <CaretDown
              size={14}
              weight="bold"
              style={{
                marginLeft: 'auto',
                transform: entitiesOpen ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
                color: 'var(--text-3)',
              }}
            />
          </button>
          {entitiesOpen && (
            <div
              style={{
                paddingLeft: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {tabs
                .filter((t) => ENTITY_TAB_IDS.has(t.id))
                .map((tab) => renderTabButton(tab, true))}
            </div>
          )}
        </div>
        {tabs
          .filter((t) => !ENTITY_TAB_IDS.has(t.id) && t.id !== 'stats')
          .map((tab) => renderTabButton(tab))}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {actionError && (
          <div className="form-error" style={{ marginBottom: 16 }}>
            {actionError}
          </div>
        )}
        {actionSuccess && (
          <div
            style={{
              marginBottom: 16,
              padding: '10px 12px',
              borderRadius: 'var(--r-sm)',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              background: 'rgba(34, 197, 94, 0.1)',
              color: '#16a34a',
              fontSize: '0.86rem',
              fontWeight: 700,
            }}
          >
            {actionSuccess}
          </div>
        )}
        {activeTab === 'stats' && stats && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            <StatCard
              label="Пользователи"
              value={stats.total_users ?? sumValues(stats.users_by_permission)}
              icon={<UsersThree size={22} />}
              growth={stats.growth?.users}
              onClick={() => setActiveTab('users')}
            />
            <StatCard
              label="Рестораны"
              value={stats.total_restaurants || 0}
              icon={<Storefront size={22} />}
              growth={stats.growth?.restaurants}
              onClick={() => setActiveTab('restaurants')}
            />
            <StatCard
              label="Заказы"
              value={sumValues(stats.orders_by_status)}
              icon={<Package size={22} />}
              growth={stats.growth?.orders}
              onClick={() => setActiveTab('orders')}
            />
            <StatCard
              label="Вендоры"
              value={stats.total_vendors || 0}
              icon={<UsersThree size={22} />}
              growth={stats.growth?.vendors}
              onClick={() => setActiveTab('vendors')}
            />
          </div>
        )}

        {activeTab === 'stats' && stats?.users_by_role && (
          <div style={{ marginTop: 16 }}>
            <UsersByRoleChart data={stats.users_by_role} />
            {stats.orders_by_status && (
              <div
                style={{
                  marginTop: 20,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
                  gap: 20,
                }}
              >
                <OrderStatusPieChart
                  data={Object.fromEntries(
                    Object.entries(stats.orders_by_status).map(([k, v]) => [
                      translate(ORDER_STATUS_RU, k),
                      v,
                    ])
                  )}
                />
              </div>
            )}
          </div>
        )}

        {activeTab === 'finance' && (
          <div
            className={
              financeLoading || analyticsLoading ? 'loading-dim' : undefined
            }
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{ ...filterGridStyle, marginBottom: 12 }}>
              <input
                className="form-input"
                type="date"
                value={financeFilters.date_from}
                onChange={(e) => {
                  setActivePreset(null);
                  setFinanceFilters({
                    ...financeFilters,
                    date_from: e.target.value,
                  });
                }}
              />
              <input
                className="form-input"
                type="date"
                value={financeFilters.date_to}
                onChange={(e) => {
                  setActivePreset(null);
                  setFinanceFilters({
                    ...financeFilters,
                    date_to: e.target.value,
                  });
                }}
              />
              <select
                className="form-input"
                value={financeFilters.restaurant_id}
                onChange={(e) =>
                  setFinanceFilters({
                    ...financeFilters,
                    restaurant_id: e.target.value,
                  })
                }
                style={selectFilterStyle}
              >
                <option value="">Все рестораны</option>
                {allRestaurants.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                marginBottom: 20,
              }}
            >
              {[
                { label: 'Сегодня', days: 0 },
                { label: '3 дня', days: 3 },
                { label: '7 дней', days: 7 },
                { label: '30 дней', days: 30 },
                { label: 'Полгода', days: 180 },
                { label: 'Год', days: 365 },
                { label: 'Сбросить', days: null },
              ].map((preset) => (
                <button
                  key={preset.label}
                  className={`btn btn-sm ${activePreset === preset.days ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={() => {
                    setActivePreset(preset.days);
                    if (preset.days === null) {
                      setFinanceFilters((prev) => ({
                        ...prev,
                        date_from: '',
                        date_to: '',
                      }));
                    } else {
                      const to = new Date();
                      const from = new Date();
                      from.setDate(to.getDate() - preset.days);
                      // Use a safe formatting strategy that ignores local timezone offsets
                      const fmt = (d) => {
                        const m = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${d.getFullYear()}-${m}-${day}`;
                      };
                      setFinanceFilters((prev) => ({
                        ...prev,
                        date_from: fmt(from),
                        date_to: fmt(to),
                      }));
                    }
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
                marginBottom: 16,
                flexWrap: 'wrap',
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                disabled={exportLoading}
                onClick={() =>
                  handleExport(
                    () =>
                      adminService.exportFinancePDF({
                        date_from: financeFilters.date_from || undefined,
                        date_to: financeFilters.date_to || undefined,
                        restaurant_id:
                          financeFilters.restaurant_id || undefined,
                      }),
                    `финансы_${getRestaurantLabel()}_${getDateRangeLabel()}.pdf`
                  )
                }
              >
                {exportLoading ? '...' : '↓ Финансы PDF'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={exportLoading}
                onClick={() =>
                  handleExport(
                    () =>
                      adminService.exportAnalyticsPDF({
                        date_from: financeFilters.date_from || undefined,
                        date_to: financeFilters.date_to || undefined,
                      }),
                    `аналитика_${getRestaurantLabel()}_${getDateRangeLabel()}.pdf`
                  )
                }
              >
                {exportLoading ? '...' : '↓ Аналитика PDF'}
              </button>
              <button
                className="btn btn-secondary btn-sm"
                disabled={exportLoading}
                onClick={() =>
                  handleExport(
                    () =>
                      adminService.exportOverviewPDF({
                        date_from: financeFilters.date_from || undefined,
                        date_to: financeFilters.date_to || undefined,
                      }),
                    `обзор_платформы_${todayStr}.pdf`
                  )
                }
              >
                {exportLoading ? '...' : '↓ Обзор платформы PDF'}
              </button>
            </div>
            {financeLoading && !finance && <AnalyticsSkeleton />}
            {finance && (
              <>
                <KPICards finance={finance} />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 20,
                  }}
                >
                  <RevenueChart data={finance.revenue_by_day || []} />
                  {advancedAnalytics && (
                    <AOVDynamicsChart
                      data={advancedAnalytics.aov_dynamics || []}
                    />
                  )}
                  <TopItemsChart data={finance.top_items || []} />
                  {advancedAnalytics && (
                    <CategoryRevenueChart
                      data={(advancedAnalytics.category_revenue || []).map(
                        (item) => ({
                          ...item,
                          label: translate(CATEGORY_RU, item.label),
                        })
                      )}
                    />
                  )}
                  {advancedAnalytics && (
                    <HourlyLoadChart
                      data={advancedAnalytics.hourly_load || []}
                    />
                  )}
                  {financeFilters.restaurant_id ? (
                    <div
                      style={{
                        padding: '14px 18px',
                        borderRadius: 'var(--r-md)',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        fontSize: '0.85rem',
                        color: 'var(--text-2)',
                      }}
                    >
                      <span>
                        Топ ресторанов скрыт — активен фильтр по ресторану
                      </span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() =>
                          setFinanceFilters((prev) => ({
                            ...prev,
                            restaurant_id: '',
                          }))
                        }
                      >
                        Сбросить фильтр
                      </button>
                    </div>
                  ) : (
                    <TopRestaurantsChart data={finance.top_restaurants || []} />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'audit' && (
          <ListSection
            loading={auditLoading}
            emptyTitle="Логов пока нет"
            items={auditLogs}
          >
            <div
              style={{
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <select
                className="form-input"
                style={{ maxWidth: 180 }}
                value={auditFilters.action}
                onChange={(e) => {
                  setAuditPage(1);
                  setAuditFilters((f) => ({ ...f, action: e.target.value }));
                }}
              >
                <option value="">Все действия</option>
                {Object.entries(AUDIT_ACTION_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="form-input"
                style={{ maxWidth: 160 }}
                value={auditFilters.entity_type}
                onChange={(e) => {
                  setAuditPage(1);
                  setAuditFilters((f) => ({
                    ...f,
                    entity_type: e.target.value,
                  }));
                }}
              >
                <option value="">Все объекты</option>
                <option value="vendor">Вендор</option>
                <option value="restaurant">Ресторан</option>
              </select>
              <input
                type="date"
                className="form-input"
                style={{ maxWidth: 160 }}
                value={auditFilters.date_from}
                onChange={(e) => {
                  setAuditPage(1);
                  setAuditFilters((f) => ({ ...f, date_from: e.target.value }));
                }}
              />
              <input
                type="date"
                className="form-input"
                style={{ maxWidth: 160 }}
                value={auditFilters.date_to}
                onChange={(e) => {
                  setAuditPage(1);
                  setAuditFilters((f) => ({ ...f, date_to: e.target.value }));
                }}
              />
            </div>
            {auditLogs.map((log) => (
              <div
                key={log.id}
                style={{
                  ...cardStyle,
                  padding: '12px 16px',
                  cursor: 'pointer',
                }}
                onClick={() =>
                  setExpandedAuditId(expandedAuditId === log.id ? null : log.id)
                }
              >
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      color: 'var(--text-1)',
                    }}
                  >
                    {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                  </span>
                  <span className="order-status-badge pending">
                    {log.entity_type}
                  </span>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--text-3)',
                      marginLeft: 'auto',
                    }}
                  >
                    {new Date(log.created_at).toLocaleString('ru-RU')}
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-3)',
                    marginTop: 4,
                  }}
                >
                  Объект: {log.entity_id || '—'}
                </div>
                {expandedAuditId === log.id && (
                  <pre
                    style={{
                      marginTop: 8,
                      fontSize: '0.75rem',
                      color: 'var(--text-2)',
                      background: 'var(--bg-surface)',
                      borderRadius: 6,
                      padding: 8,
                      overflow: 'auto',
                    }}
                  >
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
            <Pagination
              page={auditPage}
              totalPages={Math.ceil(auditTotal / PAGE_SIZE)}
              onPageChange={setAuditPage}
            />
          </ListSection>
        )}

        {activeTab === 'users' && (
          <ListSection
            loading={usersLoading}
            emptyTitle="Пользователей пока нет"
            items={users}
          >
            <div style={wideFilterGridStyle}>
              <input
                className="form-input"
                style={filterControlStyle}
                placeholder="Поиск по имени или телефону"
                value={userSearchRaw}
                onChange={(event) => {
                  setUsersPage(1);
                  setUserSearchRaw(event.target.value);
                }}
              />
              <select
                className="form-input"
                style={selectFilterStyle}
                value={userFilters.role}
                onChange={(event) => {
                  setUsersPage(1);
                  setUserFilters((prev) => ({
                    ...prev,
                    role: event.target.value,
                  }));
                }}
              >
                <option value="">Все роли</option>
                {Object.entries(PERMISSION_PRESET_RU)
                  .filter(([val]) => val !== 'CUSTOMER')
                  .map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
              </select>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.82rem',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    users.length > 0 && selectedUserIds.size === users.length
                  }
                  onChange={(e) =>
                    setSelectedUserIds(
                      e.target.checked
                        ? new Set(users.map((u) => u.id))
                        : new Set()
                    )
                  }
                />
                Выбрать все
              </label>
              <button
                className="btn btn-secondary btn-sm"
                disabled={exportLoading}
                onClick={() =>
                  handleExport(
                    adminService.exportUsersCSV,
                    `пользователи_${todayStr}.csv`
                  )
                }
              >
                {exportLoading ? '...' : '↓ CSV'}
              </button>
            </div>
            {users.map((u) => (
              <div
                key={u.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={selectedUserIds.has(u.id)}
                  onChange={(e) => {
                    e.stopPropagation();
                    setSelectedUserIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(u.id);
                      else next.delete(u.id);
                      return next;
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ flexShrink: 0 }}
                />
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => loadUserDetails(u.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      loadUserDetails(u.id);
                    }
                  }}
                  style={{
                    ...cardStyle,
                    padding: 16,
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 14,
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      minWidth: 0,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: 'var(--text-1)' }}>
                        {u.name || 'Без имени'}
                      </div>
                      <div
                        style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}
                      >
                        {u.phone_number || 'Нет телефона'}
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          gap: 6,
                          marginTop: 6,
                          flexWrap: 'wrap',
                        }}
                      >
                        <span className="order-status-badge pending">
                          {permissionPresetLabel(u.permissions)}
                        </span>
                        <span
                          className={`order-status-badge ${u.is_active ? 'ready' : 'cancelled'}`}
                        >
                          {u.is_active ? 'Активен' : 'Заблокирован'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {u.id !== currentUser?.id &&
                      !hasPermission(u, PERMISSIONS.ADMIN_ACCESS) && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteUser(u.id);
                          }}
                          title="Заблокировать"
                          style={{ color: 'var(--error)' }}
                        >
                          <Trash size={16} />
                        </button>
                      )}
                  </div>
                </div>
              </div>
            ))}
            <Pagination
              page={usersPage}
              totalPages={Math.ceil(usersTotal / PAGE_SIZE)}
              onPageChange={setUsersPage}
            />
          </ListSection>
        )}

        {activeTab === 'orders' && (
          <ListSection
            loading={ordersLoading}
            emptyTitle="Заказов пока нет"
            items={orders}
          >
            <div style={wideFilterGridStyle}>
              <input
                className="form-input"
                style={filterControlStyle}
                placeholder="Клиент, телефон или ресторан"
                value={orderSearchRaw}
                onChange={(event) => {
                  setOrdersPage(1);
                  setOrderSearchRaw(event.target.value);
                }}
              />
              <input
                className="form-input"
                style={filterControlStyle}
                type="date"
                value={orderFilters.date_from}
                onChange={(event) => {
                  setOrdersPage(1);
                  setOrderFilters((prev) => ({
                    ...prev,
                    date_from: event.target.value,
                  }));
                }}
              />
              <input
                className="form-input"
                style={filterControlStyle}
                type="date"
                value={orderFilters.date_to}
                onChange={(event) => {
                  setOrdersPage(1);
                  setOrderFilters((prev) => ({
                    ...prev,
                    date_to: event.target.value,
                  }));
                }}
              />
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                flexWrap: 'wrap',
                marginBottom: 4,
              }}
            >
              {[
                ['', 'Все'],
                ['PENDING', 'Новые'],
                ['ACCEPTED', 'Принятые'],
                ['READY', 'Готовы'],
                ['COMPLETED', 'Выданы'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`category-chip${orderFilters.status === key ? ' active' : ''}`}
                  style={{ fontSize: '0.78rem', padding: '6px 12px' }}
                  onClick={() => {
                    setOrderFilters((prev) => ({ ...prev, status: key }));
                    setOrdersPage(1);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: 8,
              }}
            >
              <button
                className="btn btn-secondary btn-sm"
                disabled={exportLoading}
                onClick={() =>
                  handleExport(
                    () =>
                      adminService.exportOrdersCSV({
                        date_from: orderFilters.date_from || undefined,
                        date_to: orderFilters.date_to || undefined,
                        status: orderFilters.status || undefined,
                      }),
                    `заказы_${todayStr}.csv`
                  )
                }
              >
                {exportLoading ? '...' : '↓ CSV'}
              </button>
            </div>
            {orders.map((o) => {
              const cfg = STATUS_MAP[o.status] || {
                label: o.status,
                className: 'pending',
                icon: <Package />,
              };
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setSelectedOrder(o)}
                  style={{
                    ...cardStyle,
                    padding: 16,
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: 'var(--text-3)',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                        }}
                      >
                        Заказ #{orderTitle(o)}
                      </div>
                      <div
                        style={{
                          color: 'var(--text-1)',
                          fontWeight: 900,
                          fontSize: '1.05rem',
                          marginTop: 2,
                        }}
                      >
                        {o.total_price} ₽
                      </div>
                    </div>
                    <span className={`order-status-badge ${cfg.className}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      color: 'var(--text-3)',
                      fontSize: '0.84rem',
                    }}
                  >
                    <div>
                      <b style={{ color: 'var(--text-2)' }}>
                        {o.customer_name || 'Клиент'}
                      </b>
                      {o.customer_phone && <span> · {o.customer_phone}</span>}
                    </div>
                    {(o.restaurant_name || o.restaurant_address) && (
                      <div>
                        {o.restaurant_name && (
                          <b style={{ color: 'var(--text-2)' }}>
                            {o.restaurant_name}
                          </b>
                        )}
                        {o.restaurant_name && o.restaurant_address && (
                          <span> · </span>
                        )}
                        {o.restaurant_address && (
                          <span>{o.restaurant_address}</span>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
            <Pagination
              page={ordersPage}
              totalPages={Math.ceil(ordersTotal / PAGE_SIZE)}
              onPageChange={setOrdersPage}
            />
          </ListSection>
        )}

        {activeTab === 'resolution' && (
          <ListSection
            loading={ordersLoading}
            emptyTitle="Проблемных заказов не найдено"
            items={orders}
          >
            <div
              style={{
                marginBottom: 16,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <ShieldWarning size={32} color="var(--error)" />
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                  Центр Модерации
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-3)' }}>
                  Инструменты ручной отмены и возврата средств для любых
                  заказов.
                </div>
              </div>
            </div>
            <div style={wideFilterGridStyle}>
              <input
                className="form-input"
                style={filterControlStyle}
                placeholder="ID заказа, телефон клиента"
                value={orderSearchRaw}
                onChange={(event) => {
                  setOrdersPage(1);
                  setOrderSearchRaw(event.target.value);
                }}
              />
              <select
                className="form-input"
                style={filterControlStyle}
                value={orderFilters.status}
                onChange={(event) => {
                  setOrdersPage(1);
                  setOrderFilters((prev) => ({
                    ...prev,
                    status: event.target.value,
                  }));
                }}
              >
                <option value="">Все статусы</option>
                <option value="PENDING">Новые</option>
                <option value="ACCEPTED">Принятые</option>
                <option value="READY">Готовы</option>
                <option value="COMPLETED">Выданы (Требуют возврата?)</option>
              </select>
            </div>
            {orders.map((o) => {
              const cfg = STATUS_MAP[o.status] || {
                label: o.status,
                className: 'pending',
                icon: <Package />,
              };
              return (
                <div
                  key={o.id}
                  style={{
                    ...cardStyle,
                    padding: 16,
                    textAlign: 'left',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          color: 'var(--text-3)',
                          fontSize: '0.74rem',
                          fontWeight: 800,
                        }}
                      >
                        Заказ #{orderTitle(o)}
                      </div>
                      <div
                        style={{
                          color: 'var(--text-1)',
                          fontWeight: 900,
                          fontSize: '1.05rem',
                          marginTop: 2,
                        }}
                      >
                        {o.total_price} ₽
                      </div>
                    </div>
                    <span className={`order-status-badge ${cfg.className}`}>
                      {cfg.icon} {cfg.label}
                    </span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 3,
                      color: 'var(--text-3)',
                      fontSize: '0.84rem',
                    }}
                  >
                    <div>
                      <b style={{ color: 'var(--text-2)' }}>
                        {o.customer_name || 'Клиент'}
                      </b>
                      {o.customer_phone && <span> · {o.customer_phone}</span>}
                    </div>
                    {(o.restaurant_name || o.restaurant_address) && (
                      <div>
                        {o.restaurant_name && (
                          <b style={{ color: 'var(--text-2)' }}>
                            {o.restaurant_name}
                          </b>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSelectedOrder(o)}
                    >
                      Подробности
                    </button>
                    {o.status !== 'CANCELLED' && (
                      <button
                        className="btn btn-sm"
                        style={{ background: 'var(--error)', color: 'white' }}
                        onClick={() => {
                          setReasonDialog({
                            title: 'Принудительная отмена',
                            message: `Вы уверены, что хотите отменить заказ #${orderTitle(o)}?`,
                            confirmLabel: 'Отменить',
                            onConfirm: async (reason) => {
                              try {
                                await adminService.forceCancelOrder(
                                  o.id,
                                  reason
                                );
                                setOrdersPage(1);
                              } catch (err) {
                                setActionError(
                                  'Ошибка отмены: ' +
                                    (err.response?.data?.detail || err.message)
                                );
                              }
                            },
                          });
                        }}
                      >
                        Принудительная отмена / Возврат
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            <Pagination
              page={ordersPage}
              totalPages={Math.ceil(ordersTotal / PAGE_SIZE)}
              onPageChange={setOrdersPage}
            />
          </ListSection>
        )}

        {activeTab === 'restaurants' && (
          <ListSection
            loading={restaurantsLoading}
            emptyTitle="Ресторанов пока нет"
            items={restaurants}
          >
            <div style={filterGridStyle}>
              <input
                className="form-input"
                style={filterControlStyle}
                placeholder="Ресторан"
                value={restaurantSearchRaw}
                onChange={(event) => {
                  setRestaurantsPage(1);
                  setRestaurantSearchRaw(event.target.value);
                }}
              />
              <input
                className="form-input"
                style={filterControlStyle}
                placeholder="Вендор или телефон"
                value={restaurantVendorSearchRaw}
                onChange={(event) => {
                  setRestaurantsPage(1);
                  setRestaurantVendorSearchRaw(event.target.value);
                }}
              />
              <select
                className="form-input"
                style={selectFilterStyle}
                value={restaurantFilters.is_open}
                onChange={(event) => {
                  setRestaurantsPage(1);
                  setRestaurantFilters((prev) => ({
                    ...prev,
                    is_open: event.target.value,
                  }));
                }}
              >
                <option value="">Любой статус</option>
                <option value="true">Открыт</option>
                <option value="false">Закрыт</option>
              </select>
              <select
                className="form-input"
                style={selectFilterStyle}
                value={restaurantFilters.moderation_status}
                onChange={(event) => {
                  setRestaurantsPage(1);
                  setRestaurantFilters((prev) => ({
                    ...prev,
                    moderation_status: event.target.value,
                  }));
                }}
              >
                <option value="">Модерация</option>
                {Object.entries(APPROVAL_STATUS_RU).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="form-input"
                style={selectFilterStyle}
                value={restaurantFilters.min_rating}
                onChange={(event) => {
                  setRestaurantsPage(1);
                  setRestaurantFilters((prev) => ({
                    ...prev,
                    min_rating: event.target.value,
                  }));
                }}
              >
                <option value="">Любой рейтинг</option>
                <option value="4">★ от 4</option>
                <option value="3">★ от 3</option>
                <option value="2">★ от 2</option>
              </select>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.82rem',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    restaurants.length > 0 &&
                    selectedRestaurantIds.size === restaurants.length
                  }
                  onChange={(e) =>
                    setSelectedRestaurantIds(
                      e.target.checked
                        ? new Set(restaurants.map((r) => r.id))
                        : new Set()
                    )
                  }
                />
                Выбрать все
              </label>
              <button
                className="btn btn-secondary btn-sm"
                disabled={exportLoading}
                onClick={() =>
                  handleExport(
                    adminService.exportRestaurantsCSV,
                    `рестораны_${todayStr}.csv`
                  )
                }
              >
                {exportLoading ? '...' : '↓ CSV'}
              </button>
            </div>
            {restaurants.map((restaurant) => (
              <div
                key={restaurant.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={selectedRestaurantIds.has(restaurant.id)}
                  onChange={(e) => {
                    setSelectedRestaurantIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(restaurant.id);
                      else next.delete(restaurant.id);
                      return next;
                    });
                  }}
                  style={{ flexShrink: 0 }}
                />
                <button
                  type="button"
                  onClick={() => loadRestaurantDetails(restaurant.id)}
                  style={{
                    ...cardStyle,
                    padding: 16,
                    flex: 1,
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 14,
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--text-1)', fontWeight: 900 }}>
                      {restaurant.name}
                    </div>
                    <div
                      style={{
                        color: 'var(--text-3)',
                        fontSize: '0.84rem',
                        marginTop: 4,
                      }}
                    >
                      {restaurant.address}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 6,
                        marginTop: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        className={`order-status-badge ${restaurant.is_open ? 'ready' : 'cancelled'}`}
                      >
                        {restaurant.is_open ? 'Открыт' : 'Закрыт'}
                      </span>
                      <span
                        className={`order-status-badge ${restaurant.is_hiring ? 'pending' : 'cancelled'}`}
                      >
                        {restaurant.is_hiring ? 'Нанимает' : 'Не нанимает'}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: 6,
                    }}
                  >
                    <div
                      style={{
                        color: 'var(--text-3)',
                        fontSize: '0.82rem',
                        textAlign: 'right',
                      }}
                    >
                      {restaurant.orders_count || 0} заказов
                      <br />★ {restaurant.average_rating || 0}
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(
                          `/display-board/${restaurant.id}`,
                          '_blank',
                          'noopener,noreferrer'
                        );
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: 'var(--text-3)',
                        padding: '3px 7px',
                        borderRadius: 6,
                        border: '1px solid var(--border)',
                        background: 'var(--bg-surface)',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Monitor size={11} />
                      Табло
                    </div>
                  </div>
                </button>
              </div>
            ))}
            <Pagination
              page={restaurantsPage}
              totalPages={Math.ceil(restaurantsTotal / PAGE_SIZE)}
              onPageChange={setRestaurantsPage}
            />
          </ListSection>
        )}

        {activeTab === 'vendors' && (
          <ListSection
            loading={vendorsLoading}
            emptyTitle="Вендоров пока нет"
            items={vendors}
          >
            <div style={wideFilterGridStyle}>
              <input
                className="form-input"
                style={filterControlStyle}
                placeholder="Вендор или телефон"
                value={vendorSearchRaw}
                onChange={(event) => {
                  setVendorsPage(1);
                  setVendorSearchRaw(event.target.value);
                }}
              />
              <select
                className="form-input"
                style={selectFilterStyle}
                value={vendorFilters.approval_status}
                onChange={(event) => {
                  setVendorsPage(1);
                  setVendorFilters((prev) => ({
                    ...prev,
                    approval_status: event.target.value,
                  }));
                }}
              >
                <option value="">Все статусы</option>
                <option value="PENDING">На проверке</option>
                <option value="APPROVED">Одобрен</option>
                <option value="REJECTED">Отклонён</option>
              </select>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.82rem',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    vendors.length > 0 &&
                    selectedVendorIds.size === vendors.length
                  }
                  onChange={(e) =>
                    setSelectedVendorIds(
                      e.target.checked
                        ? new Set(vendors.map((v) => v.id))
                        : new Set()
                    )
                  }
                />
                Выбрать все
              </label>
              <button
                className="btn btn-secondary btn-sm"
                disabled={exportLoading}
                onClick={() =>
                  handleExport(
                    adminService.exportVendorsCSV,
                    `вендоры_${todayStr}.csv`
                  )
                }
              >
                {exportLoading ? '...' : '↓ CSV'}
              </button>
            </div>
            {vendors.map((vendor) => (
              <div
                key={vendor.id}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={selectedVendorIds.has(vendor.id)}
                  onChange={(e) => {
                    setSelectedVendorIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(vendor.id);
                      else next.delete(vendor.id);
                      return next;
                    });
                  }}
                  style={{ flexShrink: 0 }}
                />
                <button
                  type="button"
                  onClick={() => loadVendorDetails(vendor.id)}
                  style={{
                    ...cardStyle,
                    padding: 16,
                    flex: 1,
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 14,
                  }}
                >
                  <div>
                    <div style={{ color: 'var(--text-1)', fontWeight: 900 }}>
                      {vendor.name || 'Вендор без имени'}
                    </div>
                    <div
                      style={{
                        color: 'var(--text-3)',
                        fontSize: '0.84rem',
                        marginTop: 4,
                      }}
                    >
                      {vendor.phone_number || 'Нет телефона'}
                    </div>
                  </div>
                  <span className="order-status-badge pending">
                    {vendor.restaurants_count || 0} заведений
                  </span>
                </button>
              </div>
            ))}
            <Pagination
              page={vendorsPage}
              totalPages={Math.ceil(vendorsTotal / PAGE_SIZE)}
              onPageChange={setVendorsPage}
            />
          </ListSection>
        )}

        {activeTab === 'reviews' && (
          <ListSection
            loading={reviewsLoading}
            emptyTitle="Отзывов пока нет"
            items={reviews}
          >
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                marginBottom: 12,
              }}
            >
              <button
                className={`btn btn-sm ${!reviewFilters.rating ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setReviewsPage(1);
                  setReviewFilters({ rating: '' });
                }}
              >
                Все
              </button>
              {[5, 4, 3, 2, 1].map((rating) => (
                <button
                  key={rating}
                  className={`btn btn-sm ${reviewFilters.rating === rating.toString() ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => {
                    setReviewsPage(1);
                    setReviewFilters({ rating: rating.toString() });
                  }}
                >
                  ★ {rating}
                </button>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '0.82rem',
                  color: 'var(--text-3)',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    reviews.length > 0 &&
                    selectedReviewIds.size === reviews.length
                  }
                  onChange={(e) =>
                    setSelectedReviewIds(
                      e.target.checked
                        ? new Set(reviews.map((r) => r.id))
                        : new Set()
                    )
                  }
                />
                Выбрать все
              </label>
              <button
                className="btn btn-secondary btn-sm"
                disabled={exportLoading}
                onClick={() =>
                  handleExport(
                    () =>
                      adminService.exportReviewsCSV({
                        min_rating: reviewFilters.rating || undefined,
                        max_rating: reviewFilters.rating || undefined,
                      }),
                    `отзывы_${todayStr}.csv`
                  )
                }
              >
                {exportLoading ? '...' : '↓ CSV'}
              </button>
            </div>
            {reviews.map((review) => (
              <div
                key={review.id}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={selectedReviewIds.has(review.id)}
                  onChange={(e) => {
                    setSelectedReviewIds((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(review.id);
                      else next.delete(review.id);
                      return next;
                    });
                  }}
                  style={{ flexShrink: 0, marginTop: 18 }}
                />
                <div
                  style={{
                    ...cardStyle,
                    padding: 16,
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 14,
                    alignItems: 'flex-start',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ color: 'var(--text-1)', fontWeight: 900 }}>
                        {review.restaurant_name ||
                          shortId(review.restaurant_id)}
                      </span>
                      <span className="order-status-badge pending">
                        ★ {review.rating}
                      </span>
                      {review.is_verified_purchase && (
                        <span className="order-status-badge ready">
                          Покупка подтверждена
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        color: 'var(--text-3)',
                        fontSize: '0.82rem',
                        marginTop: 6,
                      }}
                    >
                      {review.user_name ||
                        review.user_phone ||
                        shortId(review.user_id)}{' '}
                      · {formatDateTime(review.created_at)}
                    </div>
                    {review.text && (
                      <div
                        style={{
                          color: 'var(--text-2)',
                          fontSize: '0.9rem',
                          marginTop: 10,
                          lineHeight: 1.5,
                        }}
                      >
                        {review.text}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDeleteReview(review.id)}
                    title="Удалить отзыв"
                    style={{ color: 'var(--error)', flexShrink: 0 }}
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            ))}
            <Pagination
              page={reviewsPage}
              totalPages={Math.ceil(reviewsTotal / PAGE_SIZE)}
              onPageChange={setReviewsPage}
            />
          </ListSection>
        )}

        {selectedUser && (
          <DetailModal
            title={selectedUser.name || 'Пользователь'}
            subtitle="Детали профиля"
            loading={userDetailsLoading}
            onClose={() => setSelectedUser(null)}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
              }}
            >
              <DetailField label="ID" mono>
                {selectedUser.id}
              </DetailField>
              <DetailField label="ФИО">
                {[selectedUser.first_name, selectedUser.last_name]
                  .filter(Boolean)
                  .join(' ') || 'Не указано'}
              </DetailField>
              <DetailField label="Отображаемое имя">
                {selectedUser.name || 'Не указано'}
              </DetailField>
              <DetailField label="Телефон">
                {selectedUser.phone_number || 'Не указан'}
              </DetailField>
              {selectedUser.telegram_username && (
                <DetailField label="Telegram">
                  @{selectedUser.telegram_username}
                </DetailField>
              )}
              {selectedUser.email && (
                <DetailField label="Email">{selectedUser.email}</DetailField>
              )}
              <DetailField label="Создан">
                {formatDateTime(selectedUser.created_at)}
              </DetailField>
              <DetailField label="Роль">
                <span className="order-status-badge pending">
                  {permissionPresetLabel(selectedUser.permissions)}
                </span>
              </DetailField>
              <DetailField label="Статус">
                <span
                  className={`order-status-badge ${selectedUser.is_active ? 'ready' : 'cancelled'}`}
                >
                  {selectedUser.is_active ? 'Активен' : 'Заблокирован'}
                </span>
              </DetailField>
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                flexWrap: 'wrap',
                flexDirection: 'column',
              }}
            >
              {selectedUser.id !== currentUser?.id &&
                !hasPermission(selectedUser, PERMISSIONS.ADMIN_ACCESS) && (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontWeight: 800, marginBottom: 8 }}>
                      Управление ролью
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {['CUSTOMER', 'VENDOR', 'STAFF'].map(
                        (role) =>
                          permissionPresetLabel(selectedUser.permissions) !==
                            PERMISSION_PRESET_RU[role] && (
                            <button
                              key={role}
                              className="btn btn-secondary btn-sm"
                              disabled={permissionActionLoading}
                              onClick={() =>
                                handleSetPermissionPreset(selectedUser.id, role)
                              }
                            >
                              {PERMISSION_PRESET_RU[role]}
                            </button>
                          )
                      )}
                      <button
                        className="btn btn-secondary btn-sm"
                        disabled={permissionActionLoading}
                        onClick={() => handleMakeAdmin(selectedUser.id)}
                        style={{ color: 'var(--error)' }}
                      >
                        Сделать админом
                      </button>
                    </div>
                  </div>
                )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {!selectedUser.is_active && (
                  <button
                    className="btn btn-secondary"
                    disabled={permissionActionLoading}
                    onClick={() => handleActivateUser(selectedUser.id)}
                    style={{ color: '#22c55e' }}
                  >
                    {permissionActionLoading ? 'Применяю...' : 'Разблокировать'}
                  </button>
                )}
                {selectedUser.is_active &&
                  selectedUser.id !== currentUser?.id &&
                  !hasPermission(selectedUser, PERMISSIONS.ADMIN_ACCESS) && (
                    <button
                      className="btn btn-secondary"
                      disabled={permissionActionLoading}
                      onClick={() => handleDeleteUser(selectedUser.id)}
                      style={{ color: 'var(--error)' }}
                    >
                      Заблокировать пользователя
                    </button>
                  )}
              </div>
            </div>
          </DetailModal>
        )}

        {selectedRestaurant && (
          <DetailModal
            title={selectedRestaurant.name}
            subtitle="Детали ресторана"
            loading={restaurantDetailsLoading}
            onClose={() => setSelectedRestaurant(null)}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <UserCircle size={18} color="var(--fire)" />
                <span style={{ fontWeight: 800 }}>Вендор</span>
              </div>
              <div style={{ marginBottom: 16 }}>
                <DetailField label="Имя">
                  {selectedRestaurant.vendor_name || 'Не указано'}
                </DetailField>
                <DetailField label="Телефон">
                  {selectedRestaurant.vendor_phone || 'Не указан'}
                </DetailField>
                <div
                  style={{
                    color: 'var(--text-3)',
                    fontSize: '0.8rem',
                    marginTop: 4,
                  }}
                >
                  ID: {selectedRestaurant.vendor_id}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Storefront size={18} color="var(--fire)" />
                <span style={{ fontWeight: 800 }}>Заведение</span>
              </div>
              <div>
                <DetailField label="Название">
                  {selectedRestaurant.name}
                </DetailField>
                <DetailField label="Адрес">
                  {selectedRestaurant.address}
                </DetailField>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  <DetailField label="Заказы">
                    {selectedRestaurant.orders_count}
                  </DetailField>
                  <DetailField label="Отзывы">
                    {selectedRestaurant.review_count}
                  </DetailField>
                  <DetailField label="Рейтинг">
                    ★ {selectedRestaurant.average_rating || 0}
                  </DetailField>
                  <DetailField label="Создан">
                    {formatDateTime(selectedRestaurant.created_at)}
                  </DetailField>
                  <DetailField label="Модерация">
                    <span className="order-status-badge pending">
                      {translate(
                        APPROVAL_STATUS_RU,
                        selectedRestaurant.moderation_status
                      )}
                    </span>
                  </DetailField>
                  <DetailField label="Работа">
                    <span
                      className={`order-status-badge ${selectedRestaurant.is_open ? 'ready' : 'cancelled'}`}
                    >
                      {selectedRestaurant.is_open ? 'Открыт' : 'Закрыт'}
                    </span>
                  </DetailField>
                </div>
                <div
                  style={{
                    color: 'var(--text-3)',
                    fontSize: '0.8rem',
                    marginTop: 12,
                  }}
                >
                  ID: {selectedRestaurant.id}
                </div>
              </div>
            </div>
            {selectedRestaurant.rejection_reason && (
              <div style={{ marginTop: 10 }}>
                <DetailField label="Причина отклонения">
                  {selectedRestaurant.rejection_reason}
                </DetailField>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                flexWrap: 'wrap',
              }}
            >
              {selectedRestaurant.moderation_status !== 'APPROVED' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => handleApproveRestaurant(selectedRestaurant.id)}
                >
                  <CheckCircle size={16} />
                  Одобрить
                </button>
              )}
              {selectedRestaurant.moderation_status !== 'REJECTED' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => handleRejectRestaurant(selectedRestaurant.id)}
                  style={{ color: 'var(--error)' }}
                >
                  <Prohibit size={16} />
                  Отклонить
                </button>
              )}
            </div>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 8 }}
              onClick={() =>
                window.open(
                  `/display-board/${selectedRestaurant.id}`,
                  '_blank',
                  'noopener,noreferrer'
                )
              }
            >
              <Monitor size={16} />
              Открыть табло
            </button>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 8 }}
              onClick={() => {
                setQrType('site');
                setQrRestaurant(selectedRestaurant);
              }}
            >
              <QrCode size={16} />
              QR для сайта
            </button>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 8 }}
              onClick={() => {
                setQrType('telegram');
                setQrRestaurant(selectedRestaurant);
              }}
            >
              <QrCode size={16} />
              QR для Telegram
            </button>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 8, color: 'var(--error)' }}
              onClick={() => handleDeleteRestaurant(selectedRestaurant.id)}
            >
              <Trash size={16} />
              Удалить ресторан
            </button>
          </DetailModal>
        )}

        {selectedVendor && (
          <DetailModal
            title={selectedVendor.name || 'Вендор'}
            subtitle="Детали вендора"
            loading={vendorDetailsLoading}
            onClose={() => setSelectedVendor(null)}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 10,
              }}
            >
              <DetailField label="ID профиля" mono>
                {selectedVendor.id}
              </DetailField>
              <DetailField label="ID пользователя" mono>
                {selectedVendor.user_id}
              </DetailField>
              <DetailField label="Имя">{selectedVendor.name}</DetailField>
              <DetailField label="Телефон">
                {selectedVendor.phone_number}
              </DetailField>
              <DetailField label="Рестораны">
                {selectedVendor.restaurants_count}
              </DetailField>
              <DetailField label="Модерация">
                <span className="order-status-badge pending">
                  {translate(
                    APPROVAL_STATUS_RU,
                    selectedVendor.approval_status
                  )}
                </span>
              </DetailField>
              <DetailField label="Создан">
                {formatDateTime(selectedVendor.created_at)}
              </DetailField>
            </div>
            {selectedVendor.rejection_reason && (
              <div style={{ marginTop: 10 }}>
                <DetailField label="Причина отклонения">
                  {selectedVendor.rejection_reason}
                </DetailField>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 16,
                flexWrap: 'wrap',
              }}
            >
              {selectedVendor.approval_status !== 'APPROVED' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => handleApproveVendor(selectedVendor.id)}
                >
                  <CheckCircle size={16} />
                  Одобрить
                </button>
              )}
              {selectedVendor.approval_status !== 'REJECTED' && (
                <button
                  className="btn btn-secondary"
                  onClick={() => handleRejectVendor(selectedVendor.id)}
                  style={{ color: 'var(--error)' }}
                >
                  <Prohibit size={16} />
                  Отклонить
                </button>
              )}
            </div>
            <button
              className="btn btn-secondary"
              style={{ marginTop: 16, color: 'var(--error)' }}
              onClick={() => handleDeleteVendor(selectedVendor.id)}
            >
              <Trash size={16} />
              Удалить вендора
            </button>
          </DetailModal>
        )}

        {selectedOrder && (
          <OrderDetailsModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            updating={null}
          />
        )}

        <ReasonDialog
          dialog={reasonDialog}
          loading={reasonLoading}
          onCancel={() => setReasonDialog(null)}
          onConfirm={runReasonAction}
        />

        {selectedUserIds.size > 0 && (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              borderTop: '1px solid var(--border)',
              padding: '12px 20px',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              zIndex: 9000,
              boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1 }}>
              Выбрано: {selectedUserIds.size} пользователей
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={batchLoading}
              onClick={() => setSelectedUserIds(new Set())}
            >
              Снять выделение
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={batchLoading}
              onClick={() => handleBatchUsers('activate')}
              style={{ color: 'var(--color-success)' }}
            >
              {batchLoading ? '...' : 'Активировать'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={batchLoading}
              onClick={() => handleBatchUsers('deactivate')}
              style={{ color: 'var(--error)' }}
            >
              {batchLoading ? '...' : 'Деактивировать'}
            </button>
          </div>
        )}

        {selectedReviewIds.size > 0 && (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              borderTop: '1px solid var(--border)',
              padding: '12px 20px',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              zIndex: 9000,
              boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1 }}>
              Выбрано: {selectedReviewIds.size} отзывов
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={batchLoading}
              onClick={() => setSelectedReviewIds(new Set())}
            >
              Снять выделение
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={batchLoading}
              onClick={handleBatchDeleteReviews}
              style={{ color: 'var(--error)' }}
            >
              {batchLoading ? '...' : 'Удалить выбранные'}
            </button>
          </div>
        )}

        {selectedVendorIds.size > 0 && (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              borderTop: '1px solid var(--border)',
              padding: '12px 20px',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              zIndex: 9000,
              boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1 }}>
              Выбрано: {selectedVendorIds.size} вендоров
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={batchLoading}
              onClick={() => setSelectedVendorIds(new Set())}
            >
              Снять выделение
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={batchLoading}
              onClick={() => handleBatchVendors('approve')}
              style={{ color: 'var(--color-success)' }}
            >
              {batchLoading ? '...' : 'Одобрить выбранных'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={batchLoading}
              onClick={() =>
                requestReason({
                  title: 'Причина отклонения',
                  onConfirm: (reason) => handleBatchVendors('reject', reason),
                })
              }
              style={{ color: 'var(--error)' }}
            >
              {batchLoading ? '...' : 'Отклонить выбранных'}
            </button>
          </div>
        )}

        {selectedRestaurantIds.size > 0 && (
          <div
            style={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              background: 'var(--bg-card)',
              borderTop: '1px solid var(--border)',
              padding: '12px 20px',
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              zIndex: 9000,
              boxShadow: '0 -4px 16px rgba(0,0,0,0.12)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: '0.9rem', flex: 1 }}>
              Выбрано: {selectedRestaurantIds.size} ресторанов
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={batchLoading}
              onClick={() => setSelectedRestaurantIds(new Set())}
            >
              Снять выделение
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={batchLoading}
              onClick={() => handleBatchRestaurants('approve')}
              style={{ color: 'var(--color-success)' }}
            >
              {batchLoading ? '...' : 'Одобрить выбранных'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={batchLoading}
              onClick={() =>
                requestReason({
                  title: 'Причина отклонения',
                  onConfirm: (reason) =>
                    handleBatchRestaurants('reject', reason),
                })
              }
              style={{ color: 'var(--error)' }}
            >
              {batchLoading ? '...' : 'Отклонить выбранных'}
            </button>
          </div>
        )}

        {qrRestaurant && (
          <QRCodeModal
            restaurant={qrRestaurant}
            initialType={qrType}
            onClose={() => setQrRestaurant(null)}
          />
        )}
      </div>
    </div>
  );
};

const ListSection = ({ loading, emptyTitle, items, children }) => {
  const isEmpty = !Array.isArray(items) || items.length === 0;

  if (loading && isEmpty) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-md)',
              padding: 16,
            }}
          >
            <div
              className="skeleton"
              style={{
                width: '30%',
                height: 16,
                marginBottom: 8,
                borderRadius: 4,
              }}
            />
            <div
              className="skeleton"
              style={{ width: '70%', height: 12, borderRadius: 4 }}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={loading ? 'loading-dim' : undefined}
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      {children}
      {isEmpty && (
        <EmptyState
          title={emptyTitle || 'Ничего не найдено'}
          subtitle="Для выбранных фильтров нет результатов"
        />
      )}
    </div>
  );
};

export default AdminDashboardPage;
