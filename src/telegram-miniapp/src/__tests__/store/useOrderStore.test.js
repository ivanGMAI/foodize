import { describe, it, expect, vi, beforeEach } from "vitest";
import { useOrderStore } from "../../store/useOrderStore";
import { cartService } from "../../services/cartService";
import { orderService } from "../../services/orderService";

vi.mock("../../services/cartService", () => ({
  cartService: {
    getCart: vi.fn(),
    updateCart: vi.fn(),
    clearCart: vi.fn(),
  },
}));

vi.mock("../../services/orderService", () => ({
  orderService: {
    create: vi.fn(),
    getMyOrders: vi.fn(),
    getById: vi.fn(),
  },
}));

describe("useOrderStore", () => {
  beforeEach(() => {
    useOrderStore.setState({
      cart: [],
      cartRestaurantId: null,
      orders: [],
      currentOrder: null,
      ordersLoading: false,
      ordersTotal: 0,
      activeOrder: null,
    });
    vi.clearAllMocks();
  });

  it("should fetch cart successfully", async () => {
    cartService.getCart.mockResolvedValueOnce({
      data: {
        data: {
          items: [{ menuItem: { id: "m1", name: "Pizza", price: 100 }, quantity: 2 }],
          restaurant_id: "rest-1",
        },
      },
    });

    await useOrderStore.getState().fetchCart();

    const state = useOrderStore.getState();
    expect(state.cart.length).toBe(1);
    expect(state.cartRestaurantId).toBe("rest-1");
  });

  it("should add to cart successfully when cart is empty", async () => {
    cartService.updateCart.mockResolvedValueOnce({});
    const menuItem = { id: "m1", name: "Pizza", price: 100 };

    await useOrderStore.getState().addToCart(menuItem, "rest-1", [], 2);

    const state = useOrderStore.getState();
    expect(state.cart.length).toBe(1);
    expect(state.cart[0].menuItem).toEqual(menuItem);
    expect(state.cart[0].quantity).toBe(2);
    expect(state.cartRestaurantId).toBe("rest-1");
    expect(cartService.updateCart).toHaveBeenCalled();
  });

  it("should increment quantity when adding the same item", async () => {
    cartService.updateCart.mockResolvedValue({});
    const menuItem = { id: "m1", name: "Pizza", price: 100 };

    useOrderStore.setState({
      cart: [
        {
          menuItem,
          quantity: 2,
          selectedOptionIds: [],
          selectedOptions: [],
          lineKey: "m1:",
        },
      ],
      cartRestaurantId: "rest-1",
    });

    await useOrderStore.getState().addToCart(menuItem, "rest-1", [], 3);

    const state = useOrderStore.getState();
    expect(state.cart[0].quantity).toBe(5);
  });

  it("should confirm and replace cart if adding item from a different restaurant", async () => {
    window.confirm = vi.fn(() => true);
    cartService.updateCart.mockResolvedValue({});
    const oldItem = { id: "m1", name: "Pizza", price: 100 };
    const newItem = { id: "m2", name: "Burger", price: 50 };

    useOrderStore.setState({
      cart: [
        {
          menuItem: oldItem,
          quantity: 2,
          selectedOptionIds: [],
          selectedOptions: [],
          lineKey: "m1:",
        },
      ],
      cartRestaurantId: "rest-1",
    });

    await useOrderStore.getState().addToCart(newItem, "rest-2", [], 1);

    const state = useOrderStore.getState();
    expect(state.cartRestaurantId).toBe("rest-2");
    expect(state.cart.length).toBe(1);
    expect(state.cart[0].menuItem).toEqual(newItem);
  });

  it("should not replace cart if different restaurant confirmation is declined", async () => {
    window.confirm = vi.fn(() => false);
    const oldItem = { id: "m1", name: "Pizza", price: 100 };
    const newItem = { id: "m2", name: "Burger", price: 50 };

    useOrderStore.setState({
      cart: [
        {
          menuItem: oldItem,
          quantity: 2,
          selectedOptionIds: [],
          selectedOptions: [],
          lineKey: "m1:",
        },
      ],
      cartRestaurantId: "rest-1",
    });

    const res = await useOrderStore.getState().addToCart(newItem, "rest-2", [], 1);

    expect(res).toBe(false);
    const state = useOrderStore.getState();
    expect(state.cartRestaurantId).toBe("rest-1");
    expect(state.cart.length).toBe(1);
  });

  it("should remove from cart and clear if quantity becomes 0", async () => {
    cartService.clearCart.mockResolvedValueOnce({});
    const menuItem = { id: "m1", name: "Pizza", price: 100 };

    useOrderStore.setState({
      cart: [
        {
          menuItem,
          quantity: 1,
          selectedOptionIds: [],
          selectedOptions: [],
          lineKey: "m1:",
        },
      ],
      cartRestaurantId: "rest-1",
    });

    await useOrderStore.getState().removeFromCart("m1", []);

    const state = useOrderStore.getState();
    expect(state.cart.length).toBe(0);
    expect(state.cartRestaurantId).toBeNull();
    expect(cartService.clearCart).toHaveBeenCalled();
  });

  it("should remove from cart and update if quantity is still > 0", async () => {
    cartService.updateCart.mockResolvedValueOnce({});
    const menuItem = { id: "m1", name: "Pizza", price: 100 };

    useOrderStore.setState({
      cart: [
        {
          menuItem,
          quantity: 2,
          selectedOptionIds: [],
          selectedOptions: [],
          lineKey: "m1:",
        },
      ],
      cartRestaurantId: "rest-1",
    });

    await useOrderStore.getState().removeFromCart("m1", []);

    const state = useOrderStore.getState();
    expect(state.cart.length).toBe(1);
    expect(state.cart[0].quantity).toBe(1);
    expect(cartService.updateCart).toHaveBeenCalled();
  });

  it("should clear cart successfully", async () => {
    cartService.clearCart.mockResolvedValueOnce({});
    useOrderStore.setState({
      cart: [{ menuItem: { id: "m1" }, quantity: 1 }],
      cartRestaurantId: "rest-1",
    });

    await useOrderStore.getState().clearCart();

    const state = useOrderStore.getState();
    expect(state.cart.length).toBe(0);
    expect(state.cartRestaurantId).toBeNull();
  });

  it("should repeat order successfully", async () => {
    cartService.updateCart.mockResolvedValueOnce({});
    cartService.getCart.mockResolvedValueOnce({
      data: {
        data: {
          items: [{ menuItem: { id: "m1", name: "Pizza", price: 90 }, quantity: 2 }],
          restaurant_id: "rest-1",
        },
      },
    });

    const order = {
      restaurant_id: "rest-1",
      items: [
        {
          menu_item_id: "m1",
          menu_item_name: "Pizza",
          price_at_purchase: 100,
          quantity: 2,
          selected_options: [{ option_id: "o1", name: "Cheese", price_delta: 10 }],
        },
      ],
    };

    await useOrderStore.getState().repeatOrder(order);

    expect(cartService.updateCart).toHaveBeenCalled();
    const state = useOrderStore.getState();
    expect(state.cart.length).toBe(1);
  });

  it("should calculate cartTotal and cartCount correctly", () => {
    useOrderStore.setState({
      cart: [
        {
          menuItem: { id: "m1", price: 100 },
          quantity: 2,
          selectedOptions: [{ price_delta: 15 }],
        },
        {
          menuItem: { id: "m2", price: 50 },
          quantity: 1,
          selectedOptions: [],
        },
      ],
    });

    expect(useOrderStore.getState().cartCount()).toBe(3);
    expect(useOrderStore.getState().cartTotal()).toBe(280);
  });

  it("should set and clear active order", () => {
    const order = { id: "o1" };
    useOrderStore.getState().setActiveOrder(order);
    expect(useOrderStore.getState().activeOrder).toEqual(order);

    useOrderStore.getState().clearActiveOrder();
    expect(useOrderStore.getState().activeOrder).toBeNull();
  });

  it("should fetch active order successfully", async () => {
    orderService.getMyOrders.mockResolvedValueOnce({
      data: {
        data: [
          { id: "o1", status: "COMPLETED" },
          { id: "o2", status: "READY" },
        ],
      },
    });

    await useOrderStore.getState().fetchActiveOrder();

    expect(useOrderStore.getState().activeOrder).toEqual({ id: "o2", status: "READY" });
  });

  it("should place order successfully", async () => {
    orderService.create.mockResolvedValueOnce({
      data: {
        data: { id: "o1", status: "PENDING" },
      },
    });
    cartService.clearCart.mockResolvedValueOnce({});

    useOrderStore.setState({
      cart: [{ menuItem: { id: "m1" }, quantity: 1, selectedOptionIds: [] }],
      cartRestaurantId: "rest-1",
    });

    const res = await useOrderStore.getState().placeOrder("PROMO", "Please rush", "18:00");

    expect(orderService.create).toHaveBeenCalled();
    expect(cartService.clearCart).toHaveBeenCalled();
    expect(res).toEqual({ id: "o1", status: "PENDING" });

    const state = useOrderStore.getState();
    expect(state.cart.length).toBe(0);
    expect(state.cartRestaurantId).toBeNull();
    expect(state.orders[0]).toEqual({ id: "o1", status: "PENDING" });
    expect(state.activeOrder).toEqual({ id: "o1", status: "PENDING" });
  });

  it("should fetch my orders successfully", async () => {
    orderService.getMyOrders.mockResolvedValueOnce({
      data: {
        data: [{ id: "o1" }],
        pagination: { total: 10 },
      },
    });

    await useOrderStore.getState().fetchMyOrders({ page: 1 });

    const state = useOrderStore.getState();
    expect(state.ordersLoading).toBe(false);
    expect(state.orders).toEqual([{ id: "o1" }]);
    expect(state.ordersTotal).toBe(10);
  });

  it("should handle error when fetching my orders", async () => {
    orderService.getMyOrders.mockRejectedValueOnce(new Error("Failed"));

    await useOrderStore.getState().fetchMyOrders();

    const state = useOrderStore.getState();
    expect(state.ordersLoading).toBe(false);
    expect(state.orders).toEqual([]);
    expect(state.ordersTotal).toBe(0);
  });

  it("should fetch order by id successfully", async () => {
    orderService.getById.mockResolvedValueOnce({
      data: {
        data: { id: "o1" },
      },
    });

    const res = await useOrderStore.getState().fetchOrder("o1");

    expect(res).toEqual({ id: "o1" });
    expect(useOrderStore.getState().currentOrder).toEqual({ id: "o1" });
  });
});
