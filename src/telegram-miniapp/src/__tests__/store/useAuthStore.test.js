import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuthStore } from "../../store/useAuthStore";
import { authService } from "../../services/authService";
import { TELEGRAM_INIT_DATA_STORAGE_KEY } from "../../telegram/sdk";

vi.mock("../../services/authService", () => ({
  authService: {
    login: vi.fn(),
    getMe: vi.fn(),
    logout: vi.fn(),
  },
}));

describe("useAuthStore", () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      isAuthenticated: false,
    });
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("should have correct initial state", () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("should set authenticated state", () => {
    const mockUser = { id: 1, name: "Test" };
    useAuthStore.getState().setAuthenticated(mockUser);
    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it("should login successfully", async () => {
    const mockUser = { id: 1, name: "Test" };
    authService.login.mockResolvedValueOnce({
      data: { data: { access_token: "access", refresh_token: "refresh" } },
    });
    authService.getMe.mockResolvedValueOnce({
      data: { data: mockUser },
    });

    await useAuthStore.getState().login({ username: "user", password: "pw" });

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(sessionStorage.getItem("access_token")).toBe("access");
    expect(sessionStorage.getItem("refresh_token")).toBe("refresh");
    expect(localStorage.getItem("foodize_tg_logged_out")).toBeNull();
  });

  it("should fetchMe successfully", async () => {
    const mockUser = { id: 1, name: "Test" };
    authService.getMe.mockResolvedValueOnce({
      data: { data: mockUser },
    });

    await useAuthStore.getState().fetchMe();

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it("should handle fetchMe failure", async () => {
    authService.getMe.mockRejectedValueOnce(new Error("Failed"));

    await useAuthStore.getState().fetchMe();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("should logout successfully", async () => {
    const mockUser = { id: 1, phone_number: "+123456" };
    useAuthStore.setState({ user: mockUser, isAuthenticated: true });
    sessionStorage.setItem("access_token", "access");
    sessionStorage.setItem(TELEGRAM_INIT_DATA_STORAGE_KEY, "init_data");
    authService.logout.mockResolvedValueOnce({});

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(localStorage.getItem("foodize_tg_last_phone")).toBe("+123456");
    expect(localStorage.getItem("foodize_tg_logged_out")).toBe("1");
    expect(sessionStorage.getItem(TELEGRAM_INIT_DATA_STORAGE_KEY)).toBe("init_data");
    expect(sessionStorage.getItem("access_token")).toBeNull();
  });
});
