import { useState, useEffect, useRef, useCallback } from 'react';
import { translateApiError } from '../../utils/translateApiError';
import {
  Storefront,
  House,
  Plus,
  CaretRight,
  ForkKnife,
  Package,
  Gear,
  X,
  Check,
  PencilSimple,
  Users,
  Tag,
  Trash,
  Clock,
  ArrowsClockwise,
  ChartLineUp,
  MonitorPlay,
  QrCode,
} from '@phosphor-icons/react';
import { useRestaurantStore } from '../../store/useRestaurantStore';
import { useModalStore } from '../../store/useModalStore';
import { useShallow } from 'zustand/react/shallow';
import { vendorService } from '../../services/vendorService';
import { orderService } from '../../services/orderService';
import { menuService } from '../../services/menuService';
import { promoService } from '../../services/promoService';
import { restaurantService } from '../../services/restaurantService';
import { createRestaurantOrdersWebSocket } from '../../services/api';
import { ROUTES } from '../../constants/routes';
import EmptyState from '../../components/ui/EmptyState';
import Pagination from '../../components/ui/Pagination';
import OrderDetailsModal from '../../components/ui/OrderDetailsModal';
import QRCodeModal from '../../components/ui/QRCodeModal';
import VendorAdvisorPanel from './VendorAdvisorPanel';
import {
  RevenueChart,
  HourlyLoadChart,
  CategoryRevenueChart,
  AOVDynamicsChart,
  KPICards,
  TopItemsChart,
  OrderStatusPieChart,
} from '../../components/dashboard/DashboardCharts';
import {
  ORDER_STATUS_RU,
  STAFF_STATUS_RU,
  CATEGORY_RU,
  translate,
} from '../../utils/locales';
import { downloadBlob } from '../../utils/download';

const STATUS_LABEL_RU = ORDER_STATUS_RU;

const NEXT_ORDER_STATUS = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'READY',
  READY: 'COMPLETED',
};

const NEXT_ORDER_LABEL_RU = {
  PENDING: 'Принять',
  ACCEPTED: 'Готово',
  READY: 'Выдать',
};

const getOrderDisplayId = (order) => order.display_id ?? order.id.slice(0, 8);

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toDateTimeLocalValue = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
};

const fromDateTimeLocalValue = (value) =>
  value ? new Date(value).toISOString() : null;

const getOrderDateKey = (order) => {
  if (!order?.created_at) return 'unknown';
  return toDateInputValue(new Date(order.created_at));
};

const formatOrderTime = (value) => {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
};

const formatOrderDateGroup = (dateKey) => {
  if (dateKey === 'unknown') return 'Без даты';

  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (dateKey === toDateInputValue(today)) return 'Сегодня';
  if (dateKey === toDateInputValue(yesterday)) return 'Вчера';

  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const getPromoConditionLabels = (promo) => {
  const labels = [];
  if (promo.first_order_only) labels.push('только первый заказ');
  if (promo.min_order_amount) labels.push(`от ${promo.min_order_amount} ₽`);
  if (promo.menu_category) {
    labels.push(CATEGORY_RU[promo.menu_category] || promo.menu_category);
  }
  return labels;
};

const ListSkeleton = ({ rows = 3 }) => (
  <div style={{ display: 'grid', gap: 10 }}>
    {Array.from({ length: rows }).map((_, index) => (
      <div
        key={index}
        className="skeleton"
        style={{ height: 64, borderRadius: 'var(--radius-md)' }}
      />
    ))}
  </div>
);

const AnalyticsSkeleton = () => (
  <div style={{ display: 'grid', gap: 16 }}>
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 12,
      }}
    >
      {[1, 2, 3, 4].map((item) => (
        <div
          key={item}
          className="skeleton"
          style={{ height: 88, borderRadius: 'var(--radius-md)' }}
        />
      ))}
    </div>
    <div
      className="skeleton"
      style={{ height: 240, borderRadius: 'var(--radius-md)' }}
    />
  </div>
);

const groupOrdersByDate = (orders) =>
  orders.reduce((groups, order) => {
    const dateKey = getOrderDateKey(order);
    const group = groups.find((item) => item.dateKey === dateKey);
    if (group) {
      group.orders.push(order);
    } else {
      groups.push({
        dateKey,
        title: formatOrderDateGroup(dateKey),
        orders: [order],
      });
    }
    return groups;
  }, []);

const createOptionDraft = () => ({
  draftId: `${Date.now()}-${Math.random()}`,
  name: '',
  price_delta: '',
});

const createOptionGroupDraft = () => ({
  draftId: `${Date.now()}-${Math.random()}`,
  name: '',
  selection_type: 'multiple',
  is_required: false,
  min_selected: 0,
  max_selected: '',
  options: [createOptionDraft()],
});

const normalizeOptionGroups = (groups = []) =>
  groups.map((group) => ({
    ...group,
    draftId: group.id || `${Date.now()}-${Math.random()}`,
    max_selected: group.max_selected ?? '',
    options: (group.options || []).map((option) => ({
      ...option,
      draftId: option.id || `${Date.now()}-${Math.random()}`,
      price_delta: option.price_delta?.toString?.() ?? '0',
    })),
  }));

const DAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const buildDefaultHours = () =>
  DAY_NAMES.map((_, i) => ({
    day_of_week: i,
    open_time: '09:00',
    close_time: '22:00',
    is_closed: false,
  }));

const VendorDashboardPage = () => {
  const {
    restaurants,
    fetchMyRestaurants,
    fetchMenu,
    loading,
    addMenuItem,
    menus,
  } = useRestaurantStore(
    useShallow((s) => ({
      restaurants: s.restaurants,
      fetchMyRestaurants: s.fetchMyRestaurants,
      fetchMenu: s.fetchMenu,
      loading: s.loading,
      addMenuItem: s.addMenuItem,
      menus: s.menus,
    }))
  );

  const [selectedRestaurant, setSelectedRestaurant] = useState(null);
  const [staffRequests, setStaffRequests] = useState([]);
  const [staffPage, setStaffPage] = useState(1);
  const [staffTotal, setStaffTotal] = useState(0);

  const [staffMembers, setStaffMembers] = useState([]);
  const [staffMembersPage, setStaffMembersPage] = useState(1);
  const [staffMembersTotal, setStaffMembersTotal] = useState(0);
  const [staffSubTab, setStaffSubTab] = useState('members');
  const [staffMemberRemoving, setStaffMemberRemoving] = useState(null);

  const [showAddRestaurant, setShowAddRestaurant] = useState(false);
  const [activeTab, setActiveTab] = useState('menu');

  const [newRestaurant, setNewRestaurant] = useState({
    name: '',
    address: '',
    avg_prep_time_minutes: 15,
    max_active_orders: '',
  });
  const [editRestaurant, setEditRestaurant] = useState(null);

  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [menuItemForm, setMenuItemForm] = useState({
    name: '',
    description: '',
    price: '',
    category: 'SHAURMA',
    prep_time_minutes: 15,
    option_groups: [],
  });

  const [restaurantOrders, setRestaurantOrders] = useState([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersStatusFilter, setOrdersStatusFilter] = useState('');
  const [ordersDateFromFilter, setOrdersDateFromFilter] = useState('');
  const [ordersDateToFilter, setOrdersDateToFilter] = useState('');
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const wsRef = useRef(null);
  const [showQr, setShowQr] = useState(false);
  const [qrType, setQrType] = useState('site');

  const [formLoading, setFormLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const { createRestaurant } = useRestaurantStore(
    useShallow((s) => ({ createRestaurant: s.createRestaurant }))
  );
  const requestConfirm = useModalStore((s) => s.requestConfirm);

  const [workingHours, setWorkingHours] = useState([]);
  const [workingHoursLoading, setWorkingHoursLoading] = useState(false);
  const [workingHoursSaved, setWorkingHoursSaved] = useState(false);
  const [workingHoursError, setWorkingHoursError] = useState('');

  const [promosList, setPromosList] = useState([]);
  const [promosLoading, setPromosLoading] = useState(false);
  const [promosError, setPromosError] = useState('');
  const [showPromoForm, setShowPromoForm] = useState(false);
  const [promoForm, setPromoForm] = useState({
    code: '',
    discount_type: 'PERCENT',
    discount_value: '',
    max_uses: '',
    expires_at: '',
    first_order_only: false,
    min_order_amount: '',
    menu_category: '',
  });
  const [promoFormLoading, setPromoFormLoading] = useState(false);

  const [vendorProfile, setVendorProfile] = useState(null);

  const [finance, setFinance] = useState(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [advancedAnalytics, setAdvancedAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [financeFilters, setFinanceFilters] = useState({
    date_from: '',
    date_to: '',
  });
  const [activePreset, setActivePreset] = useState(null);

  useEffect(() => {
    fetchMyRestaurants();
    vendorService
      .getMyProfile()
      .then((res) => {
        setVendorProfile(res.data?.data || null);
      })
      .catch(() => {});
  }, [fetchMyRestaurants]);

  useEffect(() => {
    if (selectedRestaurant) {
      fetchMenu(selectedRestaurant.id);
      setEditRestaurant(null);
    }
  }, [selectedRestaurant, fetchMenu]);

  useEffect(() => {
    vendorService
      .getStaffRequests({ page: staffPage, size: 20 })
      .then((res) => {
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setStaffRequests(list);
        setStaffTotal(res.data?.pagination?.total || list.length);
      })
      .catch(() => {});
  }, [staffPage]);

  useEffect(() => {
    vendorService
      .getStaffMembers({ page: staffMembersPage, size: 20 })
      .then((res) => {
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setStaffMembers(list);
        setStaffMembersTotal(res.data?.pagination?.total || list.length);
      })
      .catch(() => {});
  }, [staffMembersPage]);

  useEffect(() => {
    if (activeTab === 'schedule' && selectedRestaurant) {
      setWorkingHoursLoading(true);
      setWorkingHoursError('');
      restaurantService
        .getWorkingHours(selectedRestaurant.id)
        .then((res) => {
          const data = Array.isArray(res.data?.data) ? res.data.data : [];
          if (data.length === 0) {
            setWorkingHours(buildDefaultHours());
          } else {
            const sorted = [...data].sort(
              (a, b) => a.day_of_week - b.day_of_week
            );
            setWorkingHours(sorted);
          }
        })
        .catch((err) => {
          if (err?.response?.status !== 404) {
            setWorkingHoursError('Не удалось загрузить расписание');
          }
          setWorkingHours(buildDefaultHours());
        })
        .finally(() => setWorkingHoursLoading(false));
    }
  }, [activeTab, selectedRestaurant]);

  const handleSaveWorkingHours = async () => {
    if (!selectedRestaurant) return;
    setWorkingHoursLoading(true);
    setWorkingHoursError('');
    setWorkingHoursSaved(false);
    const toHHMM = (t) => (t ? t.slice(0, 5) : '00:00');
    const payload = workingHours.map((r) => ({
      day_of_week: r.day_of_week,
      open_time: toHHMM(r.open_time),
      close_time: toHHMM(r.close_time),
      is_closed: r.is_closed,
    }));
    try {
      const res = await restaurantService.setWorkingHours(
        selectedRestaurant.id,
        payload
      );
      const data = Array.isArray(res.data?.data) ? res.data.data : [];
      if (data.length > 0) {
        setWorkingHours(
          [...data].sort((a, b) => a.day_of_week - b.day_of_week)
        );
      }
      setWorkingHoursSaved(true);
      setTimeout(() => setWorkingHoursSaved(false), 2000);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setWorkingHoursError(
        typeof detail === 'string' ? detail : 'Не удалось сохранить расписание'
      );
    } finally {
      setWorkingHoursLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'promos') {
      setPromosLoading(true);
      setPromosError('');
      promoService
        .list()
        .then((res) => {
          const list = Array.isArray(res.data?.data) ? res.data.data : [];
          setPromosList(list);
        })
        .catch(() => setPromosError('Не удалось загрузить промокоды'))
        .finally(() => setPromosLoading(false));
    }
  }, [activeTab]);

  const handleCreateRestaurant = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      const r = await createRestaurant({
        ...newRestaurant,
        avg_prep_time_minutes:
          Number(newRestaurant.avg_prep_time_minutes) || 15,
        max_active_orders: newRestaurant.max_active_orders
          ? Number(newRestaurant.max_active_orders)
          : null,
      });
      setSelectedRestaurant(r);
      setShowAddRestaurant(false);
      setNewRestaurant({
        name: '',
        address: '',
        avg_prep_time_minutes: 15,
        max_active_orders: '',
      });
    } catch (err) {
      setFormError(translateApiError(err, 'Ошибка создания'));
    } finally {
      setFormLoading(false);
    }
  };

  const handleCreatePromo = async (e) => {
    e.preventDefault();
    if (!selectedRestaurant) return;
    setPromoFormLoading(true);
    setPromosError('');
    try {
      const payload = {
        code: promoForm.code,
        discount_type: promoForm.discount_type,
        discount_value: parseInt(promoForm.discount_value, 10),
        restaurant_id: selectedRestaurant.id,
        ...(promoForm.max_uses
          ? { max_uses: parseInt(promoForm.max_uses, 10) }
          : {}),
        ...(promoForm.expires_at
          ? { expires_at: new Date(promoForm.expires_at).toISOString() }
          : {}),
        first_order_only: promoForm.first_order_only,
        ...(promoForm.min_order_amount
          ? { min_order_amount: parseInt(promoForm.min_order_amount, 10) }
          : {}),
        ...(promoForm.menu_category
          ? { menu_category: promoForm.menu_category }
          : {}),
      };
      await promoService.create(payload);
      setPromoForm({
        code: '',
        discount_type: 'PERCENT',
        discount_value: '',
        max_uses: '',
        expires_at: '',
        first_order_only: false,
        min_order_amount: '',
        menu_category: '',
      });
      setShowPromoForm(false);
      const res = await promoService.list();
      const list = Array.isArray(res.data?.data) ? res.data.data : [];
      setPromosList(list);
    } catch (err) {
      setPromosError(translateApiError(err, 'Ошибка создания промокода'));
    } finally {
      setPromoFormLoading(false);
    }
  };

  const handleDeactivatePromo = async (code) => {
    setPromosError('');
    try {
      await promoService.deactivate(code);
      setPromosList((prev) => prev.filter((p) => p.code !== code));
    } catch {
      setPromosError('Не удалось деактивировать промокод');
    }
  };

  const handleUpdateRestaurant = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    const patch = editRestaurant ?? selectedRestaurant;
    if (!patch.name?.trim()) {
      setFormError('Укажите название заведения');
      setFormLoading(false);
      return;
    }
    if (!patch.address?.trim()) {
      setFormError('Укажите адрес заведения');
      setFormLoading(false);
      return;
    }
    const payload = {
      name: patch.name.trim(),
      address: patch.address.trim(),
      description: patch.description?.trim() || null,
      is_open: patch.is_open ?? false,
      is_hiring: patch.is_hiring ?? false,
      is_ordering_paused: patch.is_ordering_paused ?? false,
      ordering_paused_until: patch.ordering_paused_until
        ? fromDateTimeLocalValue(patch.ordering_paused_until)
        : null,
      avg_prep_time_minutes: Number(patch.avg_prep_time_minutes) || 15,
      max_active_orders: patch.max_active_orders
        ? Number(patch.max_active_orders)
        : null,
      ...(patch.photo_url != null ? { photo_url: patch.photo_url } : {}),
    };
    try {
      const requests = [
        restaurantService.update(selectedRestaurant.id, payload),
      ];
      await Promise.all(requests);
      await fetchMyRestaurants();
      setSelectedRestaurant({ ...selectedRestaurant, ...payload });
      setEditRestaurant(null);
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Ошибка обновления');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveMenuItem = async (e) => {
    e.preventDefault();
    if (!selectedRestaurant) return;
    setFormLoading(true);
    setFormError('');

    try {
      const { option_groups: optionGroups, ...baseForm } = menuItemForm;
      const payload = {
        ...baseForm,
        price: parseInt(baseForm.price, 10),
        prep_time_minutes: parseInt(baseForm.prep_time_minutes, 10) || 15,
      };
      let savedItem = editingItem;
      if (editingItem) {
        const res = await menuService.updateItem(
          selectedRestaurant.id,
          editingItem.id,
          payload
        );
        savedItem = res.data.data;
        setEditingItem(null);
      } else {
        savedItem = await addMenuItem(selectedRestaurant.id, payload);
        setShowAddItem(false);
      }
      await syncOptionGroups(savedItem, optionGroups);
      fetchMenu(selectedRestaurant.id, { force: true });
      setMenuItemForm({
        name: '',
        description: '',
        price: '',
        category: 'SHAURMA',
        prep_time_minutes: 15,
        option_groups: [],
      });
    } catch (err) {
      setFormError(err.response?.data?.detail || 'Ошибка сохранения');
    } finally {
      setFormLoading(false);
    }
  };

  const syncOptionGroups = async (item, groups) => {
    if (!item?.id) return;
    if (editingItem?.option_groups?.length) {
      await Promise.all(
        editingItem.option_groups.map((group) =>
          menuService.deleteOptionGroup(
            selectedRestaurant.id,
            item.id,
            group.id
          )
        )
      );
    }

    const cleanGroups = groups
      .map((group, groupIndex) => {
        const cleanOptions = (group.options || [])
          .filter((option) => option.name.trim())
          .map((option, optionIndex) => ({
            name: option.name.trim(),
            price_delta: parseInt(option.price_delta, 10) || 0,
            sort_order: optionIndex,
          }));

        if (!group.name.trim() || cleanOptions.length === 0) return null;

        const maxSelected =
          group.selection_type === 'single'
            ? 1
            : group.max_selected
              ? parseInt(group.max_selected, 10)
              : null;

        return {
          name: group.name.trim(),
          selection_type: group.selection_type,
          is_required: Boolean(group.is_required),
          min_selected: group.is_required
            ? Math.max(1, parseInt(group.min_selected, 10) || 1)
            : parseInt(group.min_selected, 10) || 0,
          max_selected: maxSelected,
          sort_order: groupIndex,
          options: cleanOptions,
        };
      })
      .filter(Boolean);

    for (const group of cleanGroups) {
      await menuService.createOptionGroup(
        selectedRestaurant.id,
        item.id,
        group
      );
    }
  };

  const [menuError, setMenuError] = useState('');
  const [ordersError, setOrdersError] = useState('');

  const fetchVendorOrders = useCallback(
    async ({ silent = false } = {}) => {
      if (!selectedRestaurant) return;
      if (!silent) setOrdersLoading(true);
      setOrdersError('');
      try {
        const res = await orderService.getByRestaurant(selectedRestaurant.id, {
          page: ordersPage,
          size: 20,
          status: ordersStatusFilter || undefined,
          date_from: ordersDateFromFilter || undefined,
          date_to: ordersDateToFilter || undefined,
        });
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setRestaurantOrders(list);
        setOrdersTotal(res.data?.pagination?.total || list.length);
      } catch (err) {
        setRestaurantOrders([]);
        setOrdersTotal(0);
        setOrdersError(
          translateApiError(
            err,
            'Не удалось загрузить заказы. Проверьте, что аккаунт вендора имеет доступ к этому заведению.'
          )
        );
      } finally {
        if (!silent) setOrdersLoading(false);
      }
    },
    [
      selectedRestaurant,
      ordersPage,
      ordersStatusFilter,
      ordersDateFromFilter,
      ordersDateToFilter,
    ]
  );

  useEffect(() => {
    if (selectedRestaurant && activeTab === 'orders') {
      fetchVendorOrders();
      if (
        ordersPage === 1 &&
        !ordersStatusFilter &&
        !ordersDateFromFilter &&
        !ordersDateToFilter
      ) {
        wsRef.current = createRestaurantOrdersWebSocket(
          selectedRestaurant.id,
          () => {
            fetchVendorOrders({ silent: true });
          }
        );
      }
    }
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [
    selectedRestaurant,
    activeTab,
    ordersPage,
    ordersStatusFilter,
    ordersDateFromFilter,
    ordersDateToFilter,
    fetchVendorOrders,
  ]);

  const handleDeleteMenuItem = async (itemId) => {
    requestConfirm({
      title: 'Удалить позицию?',
      message: 'Вы уверены, что хотите удалить эту позицию из меню?',
      confirmLabel: 'Удалить',
      danger: true,
      onConfirm: async () => {
        setMenuError('');
        try {
          await menuService.deleteItem(selectedRestaurant.id, itemId);
          fetchMenu(selectedRestaurant.id, { force: true });
        } catch {
          setMenuError('Не удалось удалить позицию');
        }
      },
    });
  };

  const handleOrderChange = async (orderId, status, data = {}) => {
    setOrdersError('');
    setUpdatingOrderId(orderId);
    try {
      await orderService.updateStatus(orderId, status, data);
      setSelectedOrder((current) =>
        current?.id === orderId
          ? {
              ...current,
              status,
              ...(data.estimated_ready_in_minutes
                ? {
                    estimated_ready_at: new Date(
                      Date.now() + data.estimated_ready_in_minutes * 60000
                    ).toISOString(),
                  }
                : {}),
              ...(data.estimated_ready_at
                ? { estimated_ready_at: data.estimated_ready_at }
                : {}),
            }
          : current
      );
      await fetchVendorOrders({ silent: true });
    } catch (err) {
      setOrdersError(
        translateApiError(err, 'Не удалось изменить статус заказа')
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const todayStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const getVendorRestaurantLabel = () =>
    (selectedRestaurant?.name || 'все').replace(/\s+/g, '_');

  const getVendorDateRange = () => {
    const from = financeFilters.date_from || todayStr;
    const to = financeFilters.date_to || todayStr;
    return `${from}_${to}`;
  };

  const handleVendorExport = async (exportFn, filename) => {
    setExportLoading(true);
    try {
      const res = await exportFn();
      downloadBlob(res.data, filename);
    } catch {
      setOrdersError('Не удалось выполнить экспорт');
    } finally {
      setExportLoading(false);
    }
  };

  const handleCancelOrder = async (orderId, reason) => {
    setOrdersError('');
    setUpdatingOrderId(orderId);
    try {
      await orderService.cancelOrder(orderId, reason);
      setSelectedOrder((current) =>
        current?.id === orderId
          ? { ...current, status: 'CANCELLED', cancellation_reason: reason }
          : current
      );
      await fetchVendorOrders({ silent: true });
    } catch (err) {
      setOrdersError(translateApiError(err, 'Не удалось отменить заказ'));
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleStaffDecision = async (requestId, status) => {
    try {
      await vendorService.updateStaffStatus(requestId, status);
      setStaffRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status } : r))
      );
      if (status === 'ACCEPTED') {
        vendorService
          .getStaffMembers({ page: 1, size: 20 })
          .then((res) => {
            const list = Array.isArray(res.data?.data) ? res.data.data : [];
            setStaffMembers(list);
            setStaffMembersTotal(res.data?.pagination?.total || list.length);
          })
          .catch(() => {});
      }
    } catch {}
  };

  const handleRemoveStaffMember = async (profileId) => {
    if (!window.confirm('Уволить сотрудника?')) return;
    setStaffMemberRemoving(profileId);
    try {
      await vendorService.removeStaffMember(profileId);
      setStaffMembers((prev) => prev.filter((m) => m.id !== profileId));
      setStaffMembersTotal((t) => t - 1);
    } catch {}
    setStaffMemberRemoving(null);
  };

  const selectedMenu = selectedRestaurant
    ? menus[selectedRestaurant.id] || []
    : [];

  const fetchAnalytics = useCallback(async () => {
    if (!selectedRestaurant) return;
    setFinanceLoading(true);
    setAnalyticsLoading(true);
    try {
      // Strip empty strings so backend date parser doesn't receive ""
      const rawParams = {
        ...financeFilters,
        restaurant_id: selectedRestaurant.id,
      };
      const params = Object.fromEntries(
        Object.entries(rawParams).filter(([, v]) => v !== '' && v != null)
      );
      const [finRes, advRes] = await Promise.all([
        vendorService.getFinance(params),
        vendorService.getAdvancedAnalytics(params),
      ]);
      setFinance(finRes.data.data);
      setAdvancedAnalytics(advRes.data.data);
    } catch {
    } finally {
      setFinanceLoading(false);
      setAnalyticsLoading(false);
    }
  }, [selectedRestaurant, financeFilters]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      fetchAnalytics();
    }
  }, [activeTab, fetchAnalytics]);

  const groupedRestaurantOrders = groupOrdersByDate(restaurantOrders);

  return (
    <div className="vendor-page page-enter">
      <h1
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '1.5rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          marginBottom: 16,
        }}
      >
        <Storefront /> Дашборд вендора
      </h1>

      {vendorProfile && vendorProfile.approval_status !== 'APPROVED' && (
        <div
          style={{
            padding: 16,
            background:
              vendorProfile.approval_status === 'PENDING'
                ? 'var(--bg-card)'
                : 'rgba(239, 68, 68, 0.1)',
            border: `1px solid ${vendorProfile.approval_status === 'PENDING' ? 'var(--border)' : 'var(--error)'}`,
            borderRadius: 'var(--radius-md)',
            marginBottom: 28,
          }}
        >
          <div
            style={{ fontWeight: 800, color: 'var(--text-1)', marginBottom: 4 }}
          >
            {vendorProfile.approval_status === 'PENDING'
              ? 'Профиль на модерации'
              : 'Профиль отклонён'}
          </div>
          <div
            style={{
              fontSize: '0.85rem',
              color: 'var(--text-3)',
              marginBottom: vendorProfile.rejection_reason ? 8 : 0,
            }}
          >
            {vendorProfile.approval_status === 'PENDING'
              ? 'Ваш профиль проверяется администратором. Ваши заведения пока не видны покупателям.'
              : 'К сожалению, ваш профиль не прошел модерацию.'}
          </div>
          {vendorProfile.rejection_reason && (
            <div
              style={{
                fontSize: '0.85rem',
                color: 'var(--error)',
                fontWeight: 500,
              }}
            >
              Причина: {vendorProfile.rejection_reason}
            </div>
          )}
        </div>
      )}

      <div className="vendor-section">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <span
            className="vendor-section-title"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <House /> Мои заведения
          </span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddRestaurant(!showAddRestaurant)}
            disabled={vendorProfile?.approval_status !== 'APPROVED'}
            title={
              vendorProfile?.approval_status !== 'APPROVED'
                ? 'Дождитесь одобрения профиля'
                : ''
            }
          >
            <Plus size={16} /> Добавить
          </button>
        </div>

        {showAddRestaurant && (
          <form
            onSubmit={handleCreateRestaurant}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              marginBottom: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Новое заведение
            </h3>
            {formError && <div className="form-error">{formError}</div>}
            <input
              className="form-input"
              placeholder="Название"
              value={newRestaurant.name}
              onChange={(e) =>
                setNewRestaurant({ ...newRestaurant, name: e.target.value })
              }
              required
            />
            <input
              className="form-input"
              placeholder="Адрес"
              value={newRestaurant.address}
              onChange={(e) =>
                setNewRestaurant({ ...newRestaurant, address: e.target.value })
              }
              required
            />
            <input
              className="form-input"
              type="number"
              min="1"
              max="240"
              placeholder="Среднее время приготовления, минут"
              value={newRestaurant.avg_prep_time_minutes}
              onChange={(e) =>
                setNewRestaurant({
                  ...newRestaurant,
                  avg_prep_time_minutes: e.target.value,
                })
              }
            />
            <input
              className="form-input"
              type="number"
              min="1"
              max="1000"
              placeholder="Мягкий лимит активных заказов"
              value={newRestaurant.max_active_orders}
              onChange={(e) =>
                setNewRestaurant({
                  ...newRestaurant,
                  max_active_orders: e.target.value,
                })
              }
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={formLoading}
            >
              Создать
            </button>
          </form>
        )}

        {loading &&
        (!Array.isArray(restaurants) || restaurants.length === 0) ? (
          <div className="restaurant-list">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="restaurant-row"
                style={{ opacity: 1, cursor: 'default' }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    className="skeleton"
                    style={{
                      width: '60%',
                      height: 16,
                      marginBottom: 8,
                      borderRadius: 4,
                    }}
                  />
                  <div
                    className="skeleton"
                    style={{ width: '40%', height: 12, borderRadius: 4 }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : !Array.isArray(restaurants) || restaurants.length === 0 ? (
          <EmptyState
            title="Нет заведений"
            subtitle="Добавьте первое заведение"
          />
        ) : (
          <div className={`restaurant-list${loading ? ' loading-dim' : ''}`}>
            {restaurants.map((r) => (
              <div
                key={r.id}
                className={`restaurant-row${selectedRestaurant?.id === r.id ? ' active' : ''}`}
                onClick={() => setSelectedRestaurant(r)}
              >
                <div>
                  <div
                    className="restaurant-row-name"
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {r.name}
                    {r.display_id && (
                      <span
                        style={{
                          fontSize: '0.7rem',
                          color: 'var(--text-3)',
                          fontFamily: 'monospace',
                          background: 'var(--bg-surface)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          border: '1px solid var(--border)',
                          fontWeight: 'normal',
                        }}
                      >
                        @{r.display_id}
                      </span>
                    )}
                    {r.moderation_status === 'PENDING' && (
                      <span
                        className="order-status-badge pending"
                        style={{ fontSize: '0.6rem' }}
                      >
                        На модерации
                      </span>
                    )}
                    {r.moderation_status === 'REJECTED' && (
                      <span
                        className="order-status-badge cancelled"
                        style={{ fontSize: '0.6rem' }}
                      >
                        Отклонён
                      </span>
                    )}
                  </div>
                  <div className="restaurant-row-addr">{r.address}</div>
                </div>
                <span style={{ marginLeft: 'auto', color: 'var(--text-3)' }}>
                  <CaretRight />
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRestaurant && (
        <div
          style={{
            display: 'flex',
            gap: 24,
            alignItems: 'flex-start',
            marginTop: 24,
          }}
        >
          {/* Vendor Sidebar */}
          <div
            className="admin-sidebar"
            style={{
              width: 220,
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
            <div
              style={{
                fontWeight: 800,
                fontSize: '1rem',
                marginBottom: selectedRestaurant.display_id ? 4 : 12,
                color: 'var(--text-1)',
              }}
            >
              {selectedRestaurant.name}
            </div>
            {selectedRestaurant.display_id && (
              <div
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-3)',
                  marginBottom: 12,
                  fontFamily: 'monospace',
                  background: 'var(--bg-surface)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  display: 'inline-block',
                  border: '1px solid var(--border)',
                  alignSelf: 'flex-start',
                }}
              >
                @{selectedRestaurant.display_id}
              </div>
            )}
            {[
              { id: 'menu', label: 'Меню', icon: <ForkKnife size={18} /> },
              { id: 'orders', label: 'Заказы', icon: <Package size={18} /> },
              {
                id: 'analytics',
                label: 'Аналитика',
                icon: <ChartLineUp size={18} />,
              },
              {
                id: 'ai',
                label: 'ИИ-аналитик',
                icon: <ChartLineUp size={18} />,
              },
              { id: 'promos', label: 'Промокоды', icon: <Tag size={18} /> },
              {
                id: 'schedule',
                label: 'Расписание',
                icon: <Clock size={18} />,
              },
              { id: 'staff', label: 'Сотрудники', icon: <Users size={18} /> },
              { id: 'settings', label: 'Настройки', icon: <Gear size={18} /> },
            ].map((tab) => (
              <button
                key={tab.id}
                className={`btn ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (tab.id === 'settings' && selectedRestaurant) {
                    setEditRestaurant({ ...selectedRestaurant });
                  }
                }}
                style={{
                  justifyContent: 'flex-start',
                  border: 'none',
                  padding: '10px 14px',
                  gap: 10,
                  fontSize: '0.9rem',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
            <div
              style={{
                borderTop: '1px solid var(--border)',
                marginTop: 8,
                paddingTop: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <a
                href={ROUTES.DISPLAY_BOARD.replace(
                  ':restaurantId',
                  selectedRestaurant.id
                )}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--fire)',
                  textDecoration: 'none',
                  borderRadius: 'var(--r-sm)',
                }}
              >
                <MonitorPlay size={18} weight="bold" />
                Открыть табло
              </a>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setQrType('site');
                  setShowQr(true);
                }}
                style={{
                  justifyContent: 'flex-start',
                  border: 'none',
                  padding: '10px 14px',
                  gap: 10,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-2)',
                }}
              >
                <QrCode size={18} />
                QR для сайта
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setQrType('telegram');
                  setShowQr(true);
                }}
                style={{
                  justifyContent: 'flex-start',
                  border: 'none',
                  padding: '10px 14px',
                  gap: 10,
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  color: 'var(--text-2)',
                }}
              >
                <QrCode size={18} />
                QR для Telegram
              </button>
            </div>
          </div>

          <div
            className="vendor-section"
            style={{ flex: 1, minWidth: 0, margin: 0 }}
          >
            {activeTab === 'menu' && (
              <div>
                {menuError && (
                  <div className="form-error" style={{ marginBottom: 12 }}>
                    {menuError}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 16,
                  }}
                >
                  <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>
                    Позиции меню
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      disabled={exportLoading}
                      onClick={() =>
                        handleVendorExport(
                          () =>
                            vendorService.exportMenuCSV({
                              restaurant_id: selectedRestaurant || undefined,
                            }),
                          `меню_${todayStr}.csv`
                        )
                      }
                    >
                      {exportLoading ? '...' : '↓ CSV'}
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        setEditingItem(null);
                        setMenuItemForm({
                          name: '',
                          description: '',
                          price: '',
                          category: 'SHAURMA',
                          prep_time_minutes: 15,
                          option_groups: [],
                        });
                        setShowAddItem(!showAddItem);
                      }}
                    >
                      <Plus size={16} /> Позиция
                    </button>
                  </div>
                </div>

                {(showAddItem || editingItem) && (
                  <form
                    onSubmit={handleSaveMenuItem}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 16,
                      marginBottom: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <h3 style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                      {editingItem ? 'Редактировать' : 'Новая позиция'}
                    </h3>
                    {formError && <div className="form-error">{formError}</div>}
                    <input
                      className="form-input"
                      placeholder="Название"
                      value={menuItemForm.name}
                      onChange={(e) =>
                        setMenuItemForm({
                          ...menuItemForm,
                          name: e.target.value,
                        })
                      }
                      required
                    />
                    <textarea
                      className="form-input"
                      placeholder="Описание"
                      value={menuItemForm.description}
                      onChange={(e) =>
                        setMenuItemForm({
                          ...menuItemForm,
                          description: e.target.value,
                        })
                      }
                    />
                    <div style={{ display: 'flex', gap: 10 }}>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="Цена"
                        value={menuItemForm.price}
                        onChange={(e) =>
                          setMenuItemForm({
                            ...menuItemForm,
                            price: e.target.value,
                          })
                        }
                        required
                        style={{ flex: 1 }}
                      />
                      <select
                        className="form-input"
                        value={menuItemForm.category}
                        onChange={(e) =>
                          setMenuItemForm({
                            ...menuItemForm,
                            category: e.target.value,
                          })
                        }
                        style={{ flex: 1 }}
                      >
                        {Object.entries(CATEGORY_RU).map(([val, label]) => (
                          <option key={val} value={val}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 800, fontSize: '0.86rem' }}>
                            Опции блюда
                          </div>
                          <div
                            style={{
                              color: 'var(--text-3)',
                              fontSize: '0.74rem',
                            }}
                          >
                            Например: убрать лук, добавить мясо
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            setMenuItemForm((form) => ({
                              ...form,
                              option_groups: [
                                ...form.option_groups,
                                createOptionGroupDraft(),
                              ],
                            }))
                          }
                        >
                          <Plus size={14} /> Группа
                        </button>
                      </div>

                      {menuItemForm.option_groups.map((group, groupIndex) => (
                        <div
                          key={group.draftId}
                          style={{
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            padding: 12,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', gap: 8 }}>
                            <input
                              className="form-input"
                              placeholder="Название группы"
                              value={group.name}
                              onChange={(e) =>
                                setMenuItemForm((form) => ({
                                  ...form,
                                  option_groups: form.option_groups.map(
                                    (g, i) =>
                                      i === groupIndex
                                        ? { ...g, name: e.target.value }
                                        : g
                                  ),
                                }))
                              }
                              style={{ flex: 1 }}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ color: 'var(--error)' }}
                              onClick={() =>
                                setMenuItemForm((form) => ({
                                  ...form,
                                  option_groups: form.option_groups.filter(
                                    (_, i) => i !== groupIndex
                                  ),
                                }))
                              }
                            >
                              <X size={14} />
                            </button>
                          </div>

                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr',
                              gap: 8,
                            }}
                          >
                            <select
                              className="form-input"
                              value={group.selection_type}
                              onChange={(e) =>
                                setMenuItemForm((form) => ({
                                  ...form,
                                  option_groups: form.option_groups.map(
                                    (g, i) =>
                                      i === groupIndex
                                        ? {
                                            ...g,
                                            selection_type: e.target.value,
                                            max_selected:
                                              e.target.value === 'single'
                                                ? 1
                                                : g.max_selected,
                                          }
                                        : g
                                  ),
                                }))
                              }
                            >
                              <option value="multiple">Несколько</option>
                              <option value="single">Один вариант</option>
                            </select>
                            <input
                              className="form-input"
                              type="number"
                              min="1"
                              placeholder="Макс. выборов"
                              value={group.max_selected}
                              disabled={group.selection_type === 'single'}
                              onChange={(e) =>
                                setMenuItemForm((form) => ({
                                  ...form,
                                  option_groups: form.option_groups.map(
                                    (g, i) =>
                                      i === groupIndex
                                        ? { ...g, max_selected: e.target.value }
                                        : g
                                  ),
                                }))
                              }
                            />
                          </div>

                          <label
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              color: 'var(--text-2)',
                              fontSize: '0.8rem',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={group.is_required}
                              onChange={(e) =>
                                setMenuItemForm((form) => ({
                                  ...form,
                                  option_groups: form.option_groups.map(
                                    (g, i) =>
                                      i === groupIndex
                                        ? {
                                            ...g,
                                            is_required: e.target.checked,
                                            min_selected: e.target.checked
                                              ? 1
                                              : 0,
                                          }
                                        : g
                                  ),
                                }))
                              }
                            />
                            Обязательный выбор
                          </label>

                          {group.options.map((option, optionIndex) => (
                            <div
                              key={option.draftId}
                              style={{ display: 'flex', gap: 8 }}
                            >
                              <input
                                className="form-input"
                                placeholder="Опция"
                                value={option.name}
                                onChange={(e) =>
                                  setMenuItemForm((form) => ({
                                    ...form,
                                    option_groups: form.option_groups.map(
                                      (g, i) =>
                                        i === groupIndex
                                          ? {
                                              ...g,
                                              options: g.options.map((o, j) =>
                                                j === optionIndex
                                                  ? {
                                                      ...o,
                                                      name: e.target.value,
                                                    }
                                                  : o
                                              ),
                                            }
                                          : g
                                    ),
                                  }))
                                }
                                style={{ flex: 1 }}
                              />
                              <input
                                className="form-input"
                                type="number"
                                min="0"
                                placeholder="+₽"
                                value={option.price_delta}
                                onChange={(e) =>
                                  setMenuItemForm((form) => ({
                                    ...form,
                                    option_groups: form.option_groups.map(
                                      (g, i) =>
                                        i === groupIndex
                                          ? {
                                              ...g,
                                              options: g.options.map((o, j) =>
                                                j === optionIndex
                                                  ? {
                                                      ...o,
                                                      price_delta:
                                                        e.target.value,
                                                    }
                                                  : o
                                              ),
                                            }
                                          : g
                                    ),
                                  }))
                                }
                                style={{ width: 96 }}
                              />
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ color: 'var(--error)' }}
                                onClick={() =>
                                  setMenuItemForm((form) => ({
                                    ...form,
                                    option_groups: form.option_groups.map(
                                      (g, i) =>
                                        i === groupIndex
                                          ? {
                                              ...g,
                                              options: g.options.filter(
                                                (_, j) => j !== optionIndex
                                              ),
                                            }
                                          : g
                                    ),
                                  }))
                                }
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() =>
                              setMenuItemForm((form) => ({
                                ...form,
                                option_groups: form.option_groups.map((g, i) =>
                                  i === groupIndex
                                    ? {
                                        ...g,
                                        options: [
                                          ...g.options,
                                          createOptionDraft(),
                                        ],
                                      }
                                    : g
                                ),
                              }))
                            }
                          >
                            <Plus size={14} /> Опция
                          </button>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ flex: 1 }}
                        disabled={formLoading}
                      >
                        Сохранить
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setShowAddItem(false);
                          setEditingItem(null);
                          setMenuItemForm({
                            name: '',
                            description: '',
                            price: '',
                            category: 'SHAURMA',
                            prep_time_minutes: 15,
                            option_groups: [],
                          });
                        }}
                        style={{ flex: 1 }}
                      >
                        Отмена
                      </button>
                    </div>
                  </form>
                )}

                {loading && selectedMenu.length === 0 ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                          }}
                        >
                          <div
                            className="skeleton"
                            style={{
                              width: '30%',
                              height: 16,
                              borderRadius: 4,
                            }}
                          />
                          <div
                            className="skeleton"
                            style={{
                              width: '70%',
                              height: 12,
                              borderRadius: 4,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : selectedMenu.length === 0 ? (
                  <EmptyState
                    title="Меню пустое"
                    subtitle="Добавьте первую позицию"
                  />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    {selectedMenu.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                        }}
                      >
                        <div style={{ opacity: item.is_available ? 1 : 0.5 }}>
                          <div
                            style={{
                              fontWeight: 700,
                              fontSize: '0.9rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span
                              style={{
                                textDecoration: item.is_available
                                  ? 'none'
                                  : 'line-through',
                              }}
                            >
                              {item.name}
                            </span>
                            {!item.is_available && (
                              <span
                                className="order-status-badge cancelled"
                                style={{
                                  fontSize: '0.6rem',
                                  padding: '2px 6px',
                                }}
                              >
                                СТОП
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: '0.78rem',
                              color: 'var(--text-3)',
                            }}
                          >
                            {item.price} ₽ •{' '}
                            {translate(CATEGORY_RU, item.category)}
                          </div>
                          {item.option_groups?.length > 0 && (
                            <div
                              style={{
                                marginTop: 6,
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 6,
                              }}
                            >
                              {item.option_groups.map((group) => (
                                <span
                                  key={group.id}
                                  className="tag-pill"
                                  style={{
                                    fontSize: '0.68rem',
                                    background: 'var(--bg-raised)',
                                    color: 'var(--text-3)',
                                    border: '1px solid var(--border)',
                                  }}
                                >
                                  {group.name}: {group.options?.length || 0}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <button
                            className="btn btn-sm"
                            title={
                              item.is_available
                                ? 'Доступно (сделать недоступным)'
                                : 'Недоступно (сделать доступным)'
                            }
                            style={{
                              padding: '4px 12px',
                              height: 28,
                              minWidth: 56,
                              borderRadius: '20px',
                              border: '1px solid var(--border)',
                              background: item.is_available
                                ? 'var(--fire-subtle)'
                                : 'var(--bg-raised)',
                              color: item.is_available
                                ? 'var(--fire)'
                                : 'var(--text-3)',
                              transition: 'all 0.2s ease',
                            }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              // Optimistic update — flip locally right away
                              const newVal = !item.is_available;
                              const restId = selectedRestaurant.id;
                              const { menus: currentMenus } =
                                useRestaurantStore.getState();
                              const optimistic = (
                                currentMenus[restId] || []
                              ).map((m) =>
                                m.id === item.id
                                  ? { ...m, is_available: newVal }
                                  : m
                              );
                              useRestaurantStore.setState((s) => ({
                                menus: { ...s.menus, [restId]: optimistic },
                              }));
                              try {
                                await menuService.updateItem(restId, item.id, {
                                  is_available: newVal,
                                });
                              } catch {
                                // Revert on failure
                                useRestaurantStore.setState((s) => ({
                                  menus: {
                                    ...s.menus,
                                    [restId]: currentMenus[restId],
                                  },
                                }));
                                setMenuError(
                                  'Не удалось изменить статус блюда'
                                );
                              }
                            }}
                          >
                            <span
                              style={{ fontSize: '0.72rem', fontWeight: 800 }}
                            >
                              {item.is_available ? 'ВКЛ' : 'ВЫКЛ'}
                            </span>
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              setEditingItem(item);
                              setMenuItemForm({
                                name: item.name,
                                description: item.description,
                                price: item.price.toString(),
                                category: item.category,
                                prep_time_minutes: item.prep_time_minutes,
                                option_groups: normalizeOptionGroups(
                                  item.option_groups || []
                                ),
                              });
                            }}
                          >
                            <PencilSimple size={16} />
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ color: 'var(--error)' }}
                            onClick={() => handleDeleteMenuItem(item.id)}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'orders' && (
              <div>
                {ordersError && (
                  <div className="form-error" style={{ marginBottom: 12 }}>
                    {ordersError}
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    marginBottom: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                      Заказы заведения
                    </div>
                    <div
                      style={{ color: 'var(--text-3)', fontSize: '0.76rem' }}
                    >
                      Новые заказы обновляются автоматически
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={exportLoading}
                      onClick={() =>
                        handleVendorExport(
                          () =>
                            vendorService.exportOrdersCSV({
                              restaurant_id:
                                selectedRestaurant?.id || undefined,
                              status: ordersStatusFilter || undefined,
                            }),
                          `заказы_${todayStr}.csv`
                        )
                      }
                    >
                      {exportLoading ? '...' : '↓ CSV'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => fetchVendorOrders()}
                      disabled={ordersLoading}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <ArrowsClockwise size={14} />
                      {ordersLoading ? '...' : 'Обновить'}
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: 6,
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  {[
                    { key: '', label: 'Все' },
                    { key: 'PENDING', label: 'Новые' },
                    { key: 'ACCEPTED', label: 'Принятые' },
                    { key: 'READY', label: 'Готовые' },
                    { key: 'COMPLETED', label: 'Выданные' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      className={`category-chip${ordersStatusFilter === key ? ' active' : ''}`}
                      style={{ fontSize: '0.78rem', padding: '4px 12px' }}
                      onClick={() => {
                        setOrdersStatusFilter(key);
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
                    gap: 8,
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    marginBottom: 12,
                  }}
                >
                  <input
                    className="form-input"
                    type="date"
                    value={ordersDateFromFilter}
                    onChange={(e) => {
                      setOrdersDateFromFilter(e.target.value);
                      setOrdersPage(1);
                    }}
                    style={{ maxWidth: 140, height: 36, fontSize: '0.82rem' }}
                    aria-label="Дата с"
                  />
                  <span style={{ color: 'var(--text-3)', fontSize: '0.9rem' }}>
                    —
                  </span>
                  <input
                    className="form-input"
                    type="date"
                    value={ordersDateToFilter}
                    onChange={(e) => {
                      setOrdersDateToFilter(e.target.value);
                      setOrdersPage(1);
                    }}
                    style={{ maxWidth: 140, height: 36, fontSize: '0.82rem' }}
                    aria-label="Дата по"
                  />
                  {(ordersDateFromFilter || ordersDateToFilter) && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setOrdersDateFromFilter('');
                        setOrdersDateToFilter('');
                        setOrdersPage(1);
                      }}
                    >
                      Сбросить период
                    </button>
                  )}
                </div>
                {ordersLoading &&
                (!Array.isArray(restaurantOrders) ||
                  restaurantOrders.length === 0) ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {[1, 2].map((i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div
                          className="skeleton"
                          style={{
                            width: '100px',
                            height: 12,
                            borderRadius: 4,
                          }}
                        />
                        {[1, 2].map((j) => (
                          <div
                            key={j}
                            className="order-card skeleton"
                            style={{ height: 80, border: 'none' }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : !Array.isArray(restaurantOrders) ||
                  restaurantOrders.length === 0 ? (
                  <EmptyState
                    title="Нет заказов"
                    subtitle={
                      ordersStatusFilter
                        ? 'В этом статусе заказов нет'
                        : 'Пока никто не сделал заказ'
                    }
                  />
                ) : (
                  <div
                    className={ordersLoading ? 'loading-dim' : undefined}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                    }}
                  >
                    {groupedRestaurantOrders.map((group) => (
                      <div
                        key={group.dateKey}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            color: 'var(--text-3)',
                            fontSize: '0.78rem',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: 0,
                            padding: '2px 2px',
                          }}
                        >
                          {group.title}
                        </div>
                        {group.orders.map((order) => (
                          <div
                            key={order.id}
                            className="order-card"
                            style={{ cursor: 'pointer' }}
                            onClick={() => setSelectedOrder(order)}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                Заказ #{getOrderDisplayId(order)}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  color: 'var(--text-3)',
                                }}
                              >
                                {formatOrderTime(order.created_at) && (
                                  <>{formatOrderTime(order.created_at)} • </>
                                )}
                                {order.items?.length || 0} позиц. •{' '}
                                {order.total_price} ₽
                                {order.requested_pickup_at && (
                                  <>
                                    {' '}
                                    • к выдаче{' '}
                                    {formatOrderTime(order.requested_pickup_at)}
                                  </>
                                )}
                              </div>
                              {order.items?.length > 0 && (
                                <div
                                  style={{
                                    marginTop: 8,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 4,
                                    color: 'var(--text-2)',
                                    fontSize: '0.78rem',
                                  }}
                                >
                                  {order.items.map((item) => (
                                    <div key={item.id}>
                                      ×{item.quantity} {item.menu_item_name}
                                      {item.selected_options?.length > 0 && (
                                        <span
                                          style={{ color: 'var(--text-3)' }}
                                        >
                                          {' '}
                                          (
                                          {item.selected_options
                                            .map(
                                              (option) =>
                                                `${option.name}${
                                                  option.price_delta
                                                    ? ` +${option.price_delta} ₽`
                                                    : ''
                                                }`
                                            )
                                            .join(', ')}
                                          )
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 6,
                              }}
                            >
                              <span
                                className={`order-status-badge ${
                                  order.status === 'PENDING'
                                    ? 'pending'
                                    : order.status === 'ACCEPTED'
                                      ? 'preparing'
                                      : 'ready'
                                }`}
                              >
                                {STATUS_LABEL_RU[order.status] ?? order.status}
                              </span>
                              {NEXT_ORDER_STATUS[order.status] && (
                                <button
                                  className="btn btn-secondary btn-sm"
                                  disabled={updatingOrderId === order.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedOrder(order);
                                  }}
                                >
                                  Детали
                                  <CaretRight size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                    <Pagination
                      page={ordersPage}
                      totalPages={Math.ceil(ordersTotal / 20)}
                      onPageChange={setOrdersPage}
                    />
                  </div>
                )}
              </div>
            )}

            {selectedOrder && (
              <OrderDetailsModal
                order={selectedOrder}
                onClose={() => setSelectedOrder(null)}
                nextStatus={NEXT_ORDER_STATUS}
                nextLabel={NEXT_ORDER_LABEL_RU}
                onStatusChange={handleOrderChange}
                onCancel={handleCancelOrder}
                updating={updatingOrderId}
              />
            )}

            {activeTab === 'promos' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    Промокоды
                  </span>
                  {selectedRestaurant && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 32,
                      }}
                      onClick={() => setShowPromoForm((v) => !v)}
                    >
                      <Plus size={14} />
                      Создать
                    </button>
                  )}
                </div>

                {promosError && <div className="form-error">{promosError}</div>}

                {showPromoForm && selectedRestaurant && (
                  <form
                    onSubmit={handleCreatePromo}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: 16,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: '0.85rem',
                        marginBottom: 4,
                      }}
                    >
                      Новый промокод
                    </div>
                    <input
                      className="form-input"
                      placeholder="Код (напр. SAVE20)"
                      value={promoForm.code}
                      onChange={(e) =>
                        setPromoForm((f) => ({
                          ...f,
                          code: e.target.value.toUpperCase(),
                        }))
                      }
                      required
                    />
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                      }}
                    >
                      <select
                        className="form-input"
                        value={promoForm.discount_type}
                        onChange={(e) =>
                          setPromoForm((f) => ({
                            ...f,
                            discount_type: e.target.value,
                          }))
                        }
                      >
                        <option value="PERCENT">% Процент</option>
                        <option value="FIXED">₽ Фиксированный</option>
                      </select>
                      <input
                        className="form-input"
                        type="number"
                        placeholder={
                          promoForm.discount_type === 'PERCENT'
                            ? 'Скидка %'
                            : 'Сумма ₽'
                        }
                        min={1}
                        value={promoForm.discount_value}
                        onChange={(e) =>
                          setPromoForm((f) => ({
                            ...f,
                            discount_value: e.target.value,
                          }))
                        }
                        required
                      />
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                      }}
                    >
                      <input
                        className="form-input"
                        type="number"
                        placeholder="Макс. использований (не обяз.)"
                        min={1}
                        value={promoForm.max_uses}
                        onChange={(e) =>
                          setPromoForm((f) => ({
                            ...f,
                            max_uses: e.target.value,
                          }))
                        }
                      />
                      <input
                        className="form-input"
                        type="datetime-local"
                        placeholder="Истекает (не обяз.)"
                        value={promoForm.expires_at}
                        onChange={(e) =>
                          setPromoForm((f) => ({
                            ...f,
                            expires_at: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 8,
                      }}
                    >
                      <input
                        className="form-input"
                        type="number"
                        placeholder="Мин. сумма (не обяз.)"
                        min={1}
                        value={promoForm.min_order_amount}
                        onChange={(e) =>
                          setPromoForm((f) => ({
                            ...f,
                            min_order_amount: e.target.value,
                          }))
                        }
                      />
                      <select
                        className="form-input"
                        value={promoForm.menu_category}
                        onChange={(e) =>
                          setPromoForm((f) => ({
                            ...f,
                            menu_category: e.target.value,
                          }))
                        }
                      >
                        <option value="">Все категории</option>
                        {Object.entries(CATEGORY_RU).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: '0.85rem',
                        marginBottom: 4,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={promoForm.first_order_only}
                        onChange={(e) =>
                          setPromoForm((f) => ({
                            ...f,
                            first_order_only: e.target.checked,
                          }))
                        }
                      />
                      Только для первого заказа
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        className="btn btn-primary btn-sm"
                        type="submit"
                        disabled={promoFormLoading}
                        style={{ flex: 1 }}
                      >
                        {promoFormLoading ? 'Создаю...' : 'Создать'}
                      </button>
                      <button
                        className="btn btn-secondary btn-sm"
                        type="button"
                        onClick={() => setShowPromoForm(false)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </form>
                )}

                {promosLoading && promosList.length === 0 ? (
                  <ListSkeleton rows={3} />
                ) : promosList.length === 0 ? (
                  <EmptyState
                    icon={<Tag size={36} />}
                    title="Нет промокодов"
                    subtitle="Создайте первый промокод для скидки клиентам"
                  />
                ) : (
                  <div className={promosLoading ? 'loading-dim' : undefined}>
                    {promosList.map((promo) =>
                      (() => {
                        const conditionLabels = getPromoConditionLabels(promo);
                        return (
                          <div
                            key={promo.id}
                            style={{
                              background: 'var(--bg-card)',
                              border: `1px solid ${promo.is_active ? 'var(--border)' : 'var(--border-faint, var(--border))'}`,
                              borderRadius: 'var(--radius-md)',
                              padding: '14px 16px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 12,
                              opacity: promo.is_active ? 1 : 0.5,
                            }}
                          >
                            <Tag
                              size={18}
                              weight="bold"
                              color={
                                promo.is_active
                                  ? 'var(--fire)'
                                  : 'var(--text-3)'
                              }
                            />
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontWeight: 800,
                                  fontSize: '0.95rem',
                                  fontFamily: 'monospace',
                                }}
                              >
                                {promo.code}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.78rem',
                                  color: 'var(--text-3)',
                                  marginTop: 2,
                                }}
                              >
                                {promo.discount_type === 'PERCENT'
                                  ? `${promo.discount_value}%`
                                  : `${promo.discount_value} ₽`}
                                {' • '}
                                {promo.used_count}/{promo.max_uses ?? '∞'} исп.
                                {promo.expires_at
                                  ? ` • до ${new Date(promo.expires_at).toLocaleDateString()}`
                                  : ''}
                              </div>
                              {conditionLabels.length > 0 && (
                                <div
                                  style={{
                                    fontSize: '0.72rem',
                                    color: 'var(--text-3)',
                                    marginTop: 4,
                                  }}
                                >
                                  Условия: {conditionLabels.join(' • ')}
                                </div>
                              )}
                            </div>
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '100px',
                                background: promo.is_active
                                  ? 'rgba(34,197,94,0.12)'
                                  : 'rgba(107,114,128,0.12)',
                                color: promo.is_active ? '#22c55e' : '#6b7280',
                                border: `1px solid ${promo.is_active ? 'rgba(34,197,94,0.3)' : 'rgba(107,114,128,0.2)'}`,
                              }}
                            >
                              {promo.is_active ? 'Активен' : 'Завершён'}
                            </span>
                            {promo.is_active && (
                              <button
                                className="btn-icon-sm danger"
                                onClick={() =>
                                  handleDeactivatePromo(promo.code)
                                }
                                title="Деактивировать"
                              >
                                <Trash size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'schedule' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                    Расписание работы
                  </span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveWorkingHours}
                    disabled={workingHoursLoading}
                  >
                    {workingHoursSaved
                      ? 'Сохранено ✓'
                      : workingHoursLoading
                        ? 'Сохранение...'
                        : 'Сохранить'}
                  </button>
                </div>

                {workingHoursError && (
                  <div className="form-error">{workingHoursError}</div>
                )}

                {workingHoursLoading && workingHours.length === 0 ? (
                  <ListSkeleton rows={7} />
                ) : (
                  <div
                    className={workingHoursLoading ? 'loading-dim' : undefined}
                    style={{
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                    }}
                  >
                    {workingHours.map((row, idx) => (
                      <div
                        key={row.day_of_week}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '40px 1fr 1fr auto',
                          alignItems: 'center',
                          gap: 10,
                          padding: '10px 16px',
                          borderBottom:
                            idx < workingHours.length - 1
                              ? '1px solid var(--border)'
                              : 'none',
                          opacity: row.is_closed ? 0.45 : 1,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            color: 'var(--text-2)',
                          }}
                        >
                          {DAY_NAMES[row.day_of_week]}
                        </span>
                        <input
                          className="form-input"
                          type="time"
                          value={row.open_time}
                          disabled={row.is_closed}
                          onChange={(e) =>
                            setWorkingHours((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? { ...r, open_time: e.target.value }
                                  : r
                              )
                            )
                          }
                          style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                        />
                        <input
                          className="form-input"
                          type="time"
                          value={row.close_time}
                          disabled={row.is_closed}
                          onChange={(e) =>
                            setWorkingHours((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? { ...r, close_time: e.target.value }
                                  : r
                              )
                            )
                          }
                          style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                        />
                        <label
                          className="form-check"
                          style={{ margin: 0, whiteSpace: 'nowrap' }}
                          title="Выходной"
                        >
                          <input
                            type="checkbox"
                            checked={row.is_closed}
                            onChange={(e) =>
                              setWorkingHours((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? { ...r, is_closed: e.target.checked }
                                    : r
                                )
                              )
                            }
                          />
                          <span
                            className="form-check-label"
                            style={{ fontSize: '0.75rem' }}
                          >
                            Вых.
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'staff' && (
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
                  <button
                    className={`btn btn-sm ${staffSubTab === 'members' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setStaffSubTab('members')}
                  >
                    Сотрудники
                  </button>
                  <button
                    className={`btn btn-sm ${staffSubTab === 'requests' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setStaffSubTab('requests')}
                  >
                    Заявки
                  </button>
                </div>

                {staffSubTab === 'members' && (
                  <>
                    {staffMembers.length === 0 ? (
                      <EmptyState
                        title="Нет сотрудников"
                        subtitle="Принятые сотрудники появятся здесь"
                      />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        {staffMembers.map((m) => (
                          <div key={m.id} className="staff-request-card">
                            <div className="staff-request-info">
                              <div style={{ fontWeight: 700 }}>
                                {m.user_name || `ID: ${m.user_id.slice(0, 8)}`}
                              </div>
                              <div
                                style={{
                                  fontSize: '0.8rem',
                                  color: 'var(--text-3)',
                                }}
                              >
                                {m.user_phone || 'Нет телефона'}
                                {m.restaurant_name && ` · ${m.restaurant_name}`}
                              </div>
                            </div>
                            <div className="staff-request-actions">
                              <button
                                className="btn btn-secondary btn-sm"
                                style={{ color: 'var(--error)' }}
                                disabled={staffMemberRemoving === m.id}
                                onClick={() => handleRemoveStaffMember(m.id)}
                              >
                                {staffMemberRemoving === m.id ? (
                                  '...'
                                ) : (
                                  <Trash size={16} />
                                )}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {staffMembersTotal > 20 && (
                      <Pagination
                        total={staffMembersTotal}
                        page={staffMembersPage}
                        size={20}
                        onChange={setStaffMembersPage}
                      />
                    )}
                  </>
                )}

                {staffSubTab === 'requests' && (
                  <>
                    {!Array.isArray(staffRequests) ||
                    staffRequests.length === 0 ? (
                      <EmptyState
                        title="Нет заявок"
                        subtitle="Заявки появятся здесь"
                      />
                    ) : (
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        {staffRequests.map((req) => (
                          <div key={req.id} className="staff-request-card">
                            <div className="staff-request-info">
                              <div style={{ fontWeight: 700 }}>
                                Пользователь #{req.user_id.slice(0, 8)}
                              </div>
                              <span className="order-status-badge pending">
                                {translate(STAFF_STATUS_RU, req.status)}
                              </span>
                            </div>
                            {req.status === 'PENDING' && (
                              <div className="staff-request-actions">
                                <button
                                  className="btn btn-primary btn-sm"
                                  onClick={() =>
                                    handleStaffDecision(req.id, 'ACCEPTED')
                                  }
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  className="btn btn-secondary btn-sm"
                                  onClick={() =>
                                    handleStaffDecision(req.id, 'REJECTED')
                                  }
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {staffTotal > 20 && (
                      <Pagination
                        total={staffTotal}
                        page={staffPage}
                        size={20}
                        onChange={setStaffPage}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div
                className={
                  financeLoading || analyticsLoading ? 'loading-dim' : undefined
                }
                style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
              >
                <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <input
                    className="form-input"
                    type="date"
                    value={financeFilters.date_from}
                    onChange={(e) => {
                      setActivePreset(null);
                      setFinanceFilters((f) => ({
                        ...f,
                        date_from: e.target.value,
                      }));
                    }}
                  />
                  <input
                    className="form-input"
                    type="date"
                    value={financeFilters.date_to}
                    onChange={(e) => {
                      setActivePreset(null);
                      setFinanceFilters((f) => ({
                        ...f,
                        date_to: e.target.value,
                      }));
                    }}
                  />
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
                      handleVendorExport(
                        () =>
                          vendorService.exportFinancePDF({
                            date_from: financeFilters.date_from || undefined,
                            date_to: financeFilters.date_to || undefined,
                            restaurant_id: selectedRestaurant?.id || undefined,
                          }),
                        `финансы_${getVendorRestaurantLabel()}_${getVendorDateRange()}.pdf`
                      )
                    }
                  >
                    {exportLoading ? '...' : '↓ Финансы PDF'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={exportLoading}
                    onClick={() =>
                      handleVendorExport(
                        () =>
                          vendorService.exportAnalyticsPDF({
                            date_from: financeFilters.date_from || undefined,
                            date_to: financeFilters.date_to || undefined,
                            restaurant_id: selectedRestaurant?.id || undefined,
                          }),
                        `аналитика_${getVendorRestaurantLabel()}_${getVendorDateRange()}.pdf`
                      )
                    }
                  >
                    {exportLoading ? '...' : '↓ Аналитика PDF'}
                  </button>
                </div>
                {financeLoading && !finance && <AnalyticsSkeleton />}
                {finance && <KPICards finance={finance} />}
                {finance && (
                  <RevenueChart data={finance.revenue_by_day || []} />
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                    gap: 20,
                    marginTop: 20,
                  }}
                >
                  {finance && (
                    <>
                      <OrderStatusPieChart
                        data={{
                          Завершены: finance.completed_orders,
                          'В процессе': Math.max(
                            0,
                            finance.total_orders -
                              finance.completed_orders -
                              finance.cancelled_orders
                          ),
                          Отменены: finance.cancelled_orders,
                        }}
                      />
                      <TopItemsChart data={finance.top_items || []} />
                    </>
                  )}
                  {advancedAnalytics && (
                    <>
                      <HourlyLoadChart
                        data={advancedAnalytics.hourly_load || []}
                      />
                      <CategoryRevenueChart
                        data={(advancedAnalytics.category_revenue || []).map(
                          (item) => ({
                            ...item,
                            label: translate(CATEGORY_RU, item.label),
                          })
                        )}
                      />
                      <AOVDynamicsChart
                        data={advancedAnalytics.aov_dynamics || []}
                      />
                    </>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <VendorAdvisorPanel restaurantId={selectedRestaurant.id} />
            )}

            {activeTab === 'settings' && (
              <div
                style={{
                  padding: 16,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <h3 style={{ fontWeight: 700, marginBottom: 12 }}>
                  Настройки ресторана
                </h3>
                <form
                  onSubmit={handleUpdateRestaurant}
                  style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
                >
                  {formError && <div className="form-error">{formError}</div>}
                  <div>
                    <label
                      style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}
                    >
                      Название
                    </label>
                    <input
                      className="form-input"
                      value={editRestaurant?.name ?? selectedRestaurant.name}
                      onChange={(e) =>
                        setEditRestaurant({
                          ...(editRestaurant || selectedRestaurant),
                          name: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label
                      style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}
                    >
                      Описание ресторана
                    </label>
                    <textarea
                      className="form-input"
                      placeholder="Краткое описание заведения для посетителей..."
                      value={
                        editRestaurant?.description ??
                        selectedRestaurant.description ??
                        ''
                      }
                      onChange={(e) =>
                        setEditRestaurant({
                          ...(editRestaurant || selectedRestaurant),
                          description: e.target.value,
                        })
                      }
                      rows={3}
                      style={{ resize: 'vertical' }}
                    />
                  </div>
                  <div>
                    <label
                      style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}
                    >
                      Адрес
                    </label>
                    <input
                      className="form-input"
                      value={
                        editRestaurant?.address ?? selectedRestaurant.address
                      }
                      onChange={(e) =>
                        setEditRestaurant({
                          ...(editRestaurant || selectedRestaurant),
                          address: e.target.value,
                        })
                      }
                    />
                  </div>
                  <label className="form-check" style={{ marginTop: 4 }}>
                    <input
                      type="checkbox"
                      checked={
                        editRestaurant?.is_open ??
                        selectedRestaurant.is_open ??
                        true
                      }
                      onChange={(e) =>
                        setEditRestaurant({
                          ...(editRestaurant || selectedRestaurant),
                          is_open: e.target.checked,
                        })
                      }
                    />
                    <span className="form-check-label">Заведение открыто</span>
                  </label>
                  <label className="form-check">
                    <input
                      type="checkbox"
                      checked={
                        editRestaurant?.is_ordering_paused ??
                        selectedRestaurant.is_ordering_paused ??
                        false
                      }
                      onChange={(e) =>
                        setEditRestaurant({
                          ...(editRestaurant || selectedRestaurant),
                          is_ordering_paused: e.target.checked,
                        })
                      }
                    />
                    <span className="form-check-label">
                      Пауза приёма заказов
                    </span>
                  </label>
                  <div>
                    <label
                      style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}
                    >
                      Пауза до
                    </label>
                    <input
                      className="form-input"
                      type="datetime-local"
                      value={toDateTimeLocalValue(
                        editRestaurant?.ordering_paused_until ??
                          selectedRestaurant.ordering_paused_until
                      )}
                      onChange={(e) =>
                        setEditRestaurant({
                          ...(editRestaurant || selectedRestaurant),
                          ordering_paused_until: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label
                      style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}
                    >
                      Среднее время приготовления, минут
                    </label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      max="240"
                      value={
                        editRestaurant?.avg_prep_time_minutes ??
                        selectedRestaurant.avg_prep_time_minutes ??
                        15
                      }
                      onChange={(e) =>
                        setEditRestaurant({
                          ...(editRestaurant || selectedRestaurant),
                          avg_prep_time_minutes: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div>
                    <label
                      style={{ fontSize: '0.8rem', color: 'var(--text-3)' }}
                    >
                      Мягкий лимит активных заказов
                    </label>
                    <input
                      className="form-input"
                      type="number"
                      min="1"
                      max="1000"
                      placeholder="Без лимита"
                      value={
                        editRestaurant?.max_active_orders ??
                        selectedRestaurant.max_active_orders ??
                        ''
                      }
                      onChange={(e) =>
                        setEditRestaurant({
                          ...(editRestaurant || selectedRestaurant),
                          max_active_orders: e.target.value,
                        })
                      }
                    />
                  </div>
                  <label className="form-check">
                    <input
                      type="checkbox"
                      checked={
                        editRestaurant?.is_hiring ??
                        selectedRestaurant.is_hiring ??
                        false
                      }
                      onChange={(e) =>
                        setEditRestaurant({
                          ...(editRestaurant || selectedRestaurant),
                          is_hiring: e.target.checked,
                        })
                      }
                    />
                    <span className="form-check-label">Набор сотрудников</span>
                  </label>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={formLoading}
                  >
                    Сохранить
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {showQr && selectedRestaurant && (
        <QRCodeModal
          restaurant={selectedRestaurant}
          initialType={qrType}
          onClose={() => setShowQr(false)}
        />
      )}
    </div>
  );
};

export default VendorDashboardPage;
