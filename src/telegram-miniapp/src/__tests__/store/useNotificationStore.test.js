import { describe, it, expect, vi, beforeEach } from "vitest";
import { useNotificationStore } from "../../store/useNotificationStore";
import { notificationService } from "../../services/notificationService";
import { createNotificationWebSocket } from "../../services/api";

vi.mock("../../services/notificationService", () => ({
  notificationService: {
    getNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    deleteAll: vi.fn(),
  },
}));

vi.mock("../../services/api", () => ({
  createNotificationWebSocket: vi.fn(),
}));

describe("useNotificationStore", () => {
  beforeEach(() => {
    // Reset the module-level socket between tests.
    useNotificationStore.getState().disconnectWs();
    useNotificationStore.setState({
      notifications: [],
      unreadCount: 0,
      total: 0,
      page: 1,
      connectionStatus: "closed",
    });
    vi.clearAllMocks();
  });

  it("should fetch notifications successfully on page 1", async () => {
    notificationService.getNotifications.mockResolvedValueOnce({
      data: {
        items: [{ id: "n1", is_read: false }],
        total: 1,
        unread_count: 1,
      },
    });

    await useNotificationStore.getState().fetchNotifications(1);

    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([{ id: "n1", is_read: false }]);
    expect(state.total).toBe(1);
    expect(state.unreadCount).toBe(1);
    expect(state.page).toBe(1);
  });

  it("should fetch notifications successfully and append on page > 1", async () => {
    useNotificationStore.setState({
      notifications: [{ id: "n1", is_read: false }],
      total: 2,
      unreadCount: 2,
      page: 1,
    });

    notificationService.getNotifications.mockResolvedValueOnce({
      data: {
        items: [{ id: "n2", is_read: true }],
        total: 2,
        unread_count: 1,
      },
    });

    await useNotificationStore.getState().fetchNotifications(2);

    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([
      { id: "n1", is_read: false },
      { id: "n2", is_read: true },
    ]);
    expect(state.total).toBe(2);
    expect(state.unreadCount).toBe(1);
    expect(state.page).toBe(2);
  });

  it("should load more notifications if not fully loaded", async () => {
    useNotificationStore.setState({
      notifications: [{ id: "n1", is_read: false }],
      total: 5,
      unreadCount: 1,
      page: 1,
    });

    notificationService.getNotifications.mockResolvedValueOnce({
      data: {
        items: [{ id: "n2", is_read: true }],
        total: 5,
        unread_count: 1,
      },
    });

    await useNotificationStore.getState().loadMore();

    const state = useNotificationStore.getState();
    expect(state.page).toBe(2);
    expect(state.notifications.length).toBe(2);
  });

  it("should not load more if fully loaded", async () => {
    useNotificationStore.setState({
      notifications: [{ id: "n1", is_read: false }],
      total: 1,
      unreadCount: 1,
      page: 1,
    });

    await useNotificationStore.getState().loadMore();

    expect(notificationService.getNotifications).not.toHaveBeenCalled();
  });

  it("should mark as read successfully", async () => {
    useNotificationStore.setState({
      notifications: [
        { id: "n1", is_read: false },
        { id: "n2", is_read: false },
      ],
      unreadCount: 2,
    });

    notificationService.markAsRead.mockResolvedValueOnce({});

    await useNotificationStore.getState().markAsRead("n1");

    const state = useNotificationStore.getState();
    expect(state.notifications[0].is_read).toBe(true);
    expect(state.notifications[1].is_read).toBe(false);
    expect(state.unreadCount).toBe(1);
  });

  it("should mark all as read successfully", async () => {
    useNotificationStore.setState({
      notifications: [
        { id: "n1", is_read: false },
        { id: "n2", is_read: false },
      ],
      unreadCount: 2,
    });

    notificationService.markAllAsRead.mockResolvedValueOnce({});

    await useNotificationStore.getState().markAllAsRead();

    const state = useNotificationStore.getState();
    expect(state.notifications.every((n) => n.is_read)).toBe(true);
    expect(state.unreadCount).toBe(0);
  });

  it("should delete a notification successfully", async () => {
    useNotificationStore.setState({
      notifications: [
        { id: "n1", is_read: false },
        { id: "n2", is_read: true },
      ],
      total: 2,
      unreadCount: 1,
    });

    notificationService.deleteNotification.mockResolvedValueOnce({});

    await useNotificationStore.getState().deleteNotification("n1");

    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([{ id: "n2", is_read: true }]);
    expect(state.total).toBe(1);
    expect(state.unreadCount).toBe(0);
  });

  it("should delete all successfully", async () => {
    useNotificationStore.setState({
      notifications: [{ id: "n1", is_read: false }],
      total: 1,
      unreadCount: 1,
    });

    notificationService.deleteAll.mockResolvedValueOnce({});

    await useNotificationStore.getState().deleteAll();

    const state = useNotificationStore.getState();
    expect(state.notifications).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.unreadCount).toBe(0);
  });

  it("should connect to WebSocket successfully", () => {
    let mockOnMessage;
    let mockOnClose;
    let mockOnStatusChange;

    const mockWs = {
      close: vi.fn(),
    };

    createNotificationWebSocket.mockImplementationOnce(
      (userId, onMessage, onClose, onStatusChange) => {
        mockOnMessage = onMessage;
        mockOnClose = onClose;
        mockOnStatusChange = onStatusChange;
        return mockWs;
      }
    );

    useNotificationStore.getState().connectWs("user-1");

    expect(createNotificationWebSocket).toHaveBeenCalledWith(
      "user-1",
      expect.any(Function),
      expect.any(Function),
      expect.any(Function)
    );

    expect(useNotificationStore.getState().connectionStatus).toBe("connecting");

    mockOnStatusChange("connected");
    expect(useNotificationStore.getState().connectionStatus).toBe("connected");

    mockOnMessage({ type: "connected" });
    expect(notificationService.getNotifications).toHaveBeenCalled();

    mockOnMessage({ id: "n3", type: "order_status", is_read: false });
    expect(useNotificationStore.getState().total).toBe(1);
    expect(useNotificationStore.getState().unreadCount).toBe(1);

    mockOnClose();
    expect(useNotificationStore.getState().connectionStatus).toBe("closed");
  });

  it("should disconnect from WebSocket", () => {
    const mockWs = { close: vi.fn() };
    createNotificationWebSocket.mockReturnValueOnce(mockWs);
    useNotificationStore.getState().connectWs("user-1");

    useNotificationStore.getState().disconnectWs();

    expect(mockWs.close).toHaveBeenCalled();
    expect(useNotificationStore.getState().connectionStatus).toBe("closed");

    // After disconnect the socket is gone, so a fresh connect opens a new one.
    createNotificationWebSocket.mockReturnValueOnce({ close: vi.fn() });
    useNotificationStore.getState().connectWs("user-1");
    expect(createNotificationWebSocket).toHaveBeenCalledTimes(2);
  });

  it("should ignore connect if already connected", () => {
    createNotificationWebSocket.mockReturnValueOnce({ close: vi.fn() });
    useNotificationStore.getState().connectWs("user-1");
    expect(createNotificationWebSocket).toHaveBeenCalledTimes(1);

    useNotificationStore.getState().connectWs("user-1");
    expect(createNotificationWebSocket).toHaveBeenCalledTimes(1);
  });
});
