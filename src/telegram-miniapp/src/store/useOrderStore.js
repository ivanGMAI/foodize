import { create } from "zustand";
import { cartService } from "../services/cartService";
import { orderService } from "../services/orderService";

const getOptionIds = (item) =>
  [
    ...new Set(
      item.selectedOptionIds ??
        item.selected_option_ids ??
        getSelectedOptions(item).map((o) => o.id ?? o.option_id),
    ),
  ].filter(Boolean);

const getSelectedOptions = (item) =>
  item.selectedOptions ?? item.selected_options ?? [];

const getOptionsTotal = (item) =>
  getSelectedOptions(item).reduce(
    (sum, o) => sum + (Number(o.price_delta) || 0),
    0,
  );

const getLinePrice = (item) =>
  (Number(item.menuItem.price) || 0) + getOptionsTotal(item);

const getLineKey = (menuItemId, selectedOptionIds = []) =>
  `${menuItemId}:${[...selectedOptionIds].sort().join(",")}`;

const uniqueOptions = (options = []) => {
  const seen = new Set();
  return options.filter((o) => {
    const id = o.id ?? o.option_id;
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const makeIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const useOrderStore = create((set, get) => ({
  cart: [],
  cartRestaurantId: null,

  fetchCart: async () => {
    try {
      const res = await cartService.getCart();
      set({
        cart: res.data.data.items ?? [],
        cartRestaurantId: res.data.data.restaurant_id ?? null,
      });
    } catch {}
  },

  _syncCart: async () => {
    const { cart, cartRestaurantId } = get();
    if (!cartRestaurantId) return;
    await cartService.updateCart({
      restaurant_id: cartRestaurantId,
      items: cart.map((i) => ({
        menu_item_id: i.menuItem.id,
        name: i.menuItem.name,
        price: i.menuItem.price,
        image_url: i.menuItem.image_url ?? null,
        quantity: i.quantity,
        selected_option_ids: getOptionIds(i),
        selected_options: uniqueOptions(getSelectedOptions(i)),
      })),
    });
  },

  addToCart: async (
    menuItem,
    restaurantId,
    selectedOptions = [],
    quantity = 1,
  ) => {
    const { cart, cartRestaurantId } = get();
    const normalizedOptions = uniqueOptions(selectedOptions);
    const safeQuantity = Math.max(1, Number(quantity) || 1);
    const selectedOptionIds = normalizedOptions.map((o) => o.id ?? o.option_id);
    const lineKey = getLineKey(menuItem.id, selectedOptionIds);
    const nextItem = {
      menuItem,
      quantity: safeQuantity,
      selectedOptionIds,
      selectedOptions: normalizedOptions.map((o) => ({
        option_id: o.id ?? o.option_id,
        id: o.id ?? o.option_id,
        name: o.name,
        price_delta: o.price_delta,
      })),
      lineKey,
    };

    if (
      cartRestaurantId &&
      cartRestaurantId !== restaurantId &&
      cart.length > 0
    ) {
      const confirmed = await new Promise((resolve) => {
        const tg = window.Telegram?.WebApp;
        if (tg?.showConfirm) {
          tg.showConfirm(
            "Заменить корзину?\nТекущие товары будут удалены.",
            resolve,
          );
        } else {
          resolve(
            window.confirm("Заменить корзину? Текущие товары будут удалены."),
          );
        }
      });
      if (!confirmed) return false;
      set({ cart: [nextItem], cartRestaurantId: restaurantId });
    } else {
      const existing = cart.find(
        (i) => getLineKey(i.menuItem.id, getOptionIds(i)) === lineKey,
      );
      if (existing) {
        set({
          cart: cart.map((i) =>
            getLineKey(i.menuItem.id, getOptionIds(i)) === lineKey
              ? { ...i, quantity: i.quantity + safeQuantity }
              : i,
          ),
        });
      } else {
        set({ cart: [...cart, nextItem], cartRestaurantId: restaurantId });
      }
    }
    await get()._syncCart();
  },

  removeFromCart: async (menuItemId, selectedOptionIds = []) => {
    const lineKey = getLineKey(menuItemId, selectedOptionIds);
    set((s) => {
      const updated = s.cart
        .map((i) =>
          getLineKey(i.menuItem.id, getOptionIds(i)) === lineKey
            ? { ...i, quantity: i.quantity - 1 }
            : i,
        )
        .filter((i) => i.quantity > 0);
      return {
        cart: updated,
        cartRestaurantId: updated.length ? s.cartRestaurantId : null,
      };
    });
    const { cart } = get();
    if (cart.length === 0) {
      await cartService.clearCart();
    } else {
      await get()._syncCart();
    }
  },

  clearCart: async () => {
    set({ cart: [], cartRestaurantId: null });
    await cartService.clearCart();
  },

  repeatOrder: async (order) => {
    const payload = {
      restaurant_id: order.restaurant_id,
      items: order.items.map((i) => {
        const optionIds =
          i.selected_options?.map((o) => o.option_id ?? o.id) || [];
        const optionsTotal = (i.selected_options || []).reduce(
          (sum, o) => sum + (Number(o.price_delta) || 0),
          0,
        );
        const basePrice = Math.max(
          0,
          (Number(i.price_at_purchase) || 0) - optionsTotal,
        );

        return {
          menu_item_id: i.menu_item_id,
          name: i.menu_item_name,
          price: basePrice,
          image_url: null,
          quantity: i.quantity,
          selected_option_ids: optionIds,
          selected_options: (i.selected_options || []).map((o) => ({
            id: o.option_id ?? o.id,
            option_id: o.option_id ?? o.id,
            name: o.name,
            price_delta: o.price_delta,
          })),
        };
      }),
    };
    await cartService.updateCart(payload);
    await get().fetchCart();
  },

  cartTotal: () =>
    get().cart.reduce((sum, i) => sum + getLinePrice(i) * i.quantity, 0),
  cartCount: () => get().cart.reduce((sum, i) => sum + i.quantity, 0),

  orders: [],
  currentOrder: null,
  ordersLoading: false,
  ordersTotal: 0,
  activeOrder: null,

  setActiveOrder: (order) => set({ activeOrder: order }),
  clearActiveOrder: () => set({ activeOrder: null }),

  fetchActiveOrder: async () => {
    try {
      const res = await orderService.getMyOrders({ page: 1, size: 5 });
      const orders = Array.isArray(res.data?.data) ? res.data.data : [];
      const active = orders.find((o) =>
        ["PENDING", "ACCEPTED", "READY"].includes(o.status),
      );
      set({ activeOrder: active ?? null });
    } catch {}
  },

  placeOrder: async (
    promoCode = null,
    comment = "",
    requestedPickupAt = null,
  ) => {
    const { cart, cartRestaurantId } = get();
    const trimmedComment = comment.trim();
    const payload = {
      restaurant_id: cartRestaurantId,
      items: cart.map((i) => ({
        menu_item_id: i.menuItem.id,
        quantity: i.quantity,
        selected_option_ids: getOptionIds(i),
      })),
      ...(promoCode ? { promo_code: promoCode } : {}),
      ...(trimmedComment ? { comment: trimmedComment } : {}),
      ...(requestedPickupAt ? { requested_pickup_at: requestedPickupAt } : {}),
    };
    const res = await orderService.create(payload, {
      headers: { "Idempotency-Key": makeIdempotencyKey() },
    });
    set((s) => ({
      orders: [res.data.data, ...s.orders],
      currentOrder: res.data.data,
      activeOrder: res.data.data,
      cart: [],
      cartRestaurantId: null,
    }));
    await cartService.clearCart();
    return res.data.data;
  },

  fetchMyOrders: async (params = {}) => {
    set({ ordersLoading: true });
    try {
      const res = await orderService.getMyOrders(params);
      const orders = Array.isArray(res.data?.data) ? res.data.data : [];
      set({
        orders,
        ordersTotal: res.data?.pagination?.total ?? orders.length,
        ordersLoading: false,
      });
    } catch {
      set({ ordersLoading: false });
    }
  },

  fetchOrder: async (id) => {
    const res = await orderService.getById(id);
    set({ currentOrder: res.data.data });
    return res.data.data;
  },
}));
