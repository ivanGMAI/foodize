import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  window.Telegram = {
    WebApp: {
      initData: "init_data_string",
      initDataUnsafe: {
        user: { id: 123, first_name: "Test" },
        start_param: "restaurant_123",
      },
      colorScheme: "dark",
      themeParams: { bg_color: "#ffffff" },
      expand: () => {},
      ready: () => {},
      close: () => {},
      showAlert: () => {},
      showConfirm: () => {},
      requestContact: (callback) => callback(true),
    },
  };
});

import { authService } from "../services/authService";
import {
  getTelegramInitData,
  getTelegramUser,
  getStartParam,
  expandApp,
  readyApp,
  getColorScheme,
  getThemeParams,
  closeApp,
  showAlert,
  showConfirm,
  requestTelegramContact,
} from "../telegram/sdk";
import {
  initTelegramApp,
  completeTelegramAuth,
  authExistingUser,
} from "../telegram/init";

vi.mock("../services/authService", () => ({
  authService: {
    telegramCheck: vi.fn(),
    telegramRegister: vi.fn(),
    telegramAuth: vi.fn(),
  },
}));

describe("Telegram WebApp SDK functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it("should get telegram user, start param, color scheme, theme params", () => {
    const mockUser = { id: 123, first_name: "Test" };
    expect(getTelegramInitData()).toBe("init_data_string");
    expect(getTelegramUser()).toEqual(mockUser);
    expect(getStartParam()).toBe("restaurant_123");
    expect(getColorScheme()).toBe("dark");
    expect(getThemeParams()).toEqual({ bg_color: "#ffffff" });

    window.Telegram.WebApp.expand = vi.fn();
    window.Telegram.WebApp.ready = vi.fn();
    window.Telegram.WebApp.close = vi.fn();
    window.Telegram.WebApp.showAlert = vi.fn();
    window.Telegram.WebApp.showConfirm = vi.fn();

    expandApp();
    expect(window.Telegram.WebApp.expand).toHaveBeenCalled();

    readyApp();
    expect(window.Telegram.WebApp.ready).toHaveBeenCalled();

    closeApp();
    expect(window.Telegram.WebApp.close).toHaveBeenCalled();

    showAlert("hello", "cb");
    expect(window.Telegram.WebApp.showAlert).toHaveBeenCalledWith("hello", "cb");

    showConfirm("confirm", "cb");
    expect(window.Telegram.WebApp.showConfirm).toHaveBeenCalledWith("confirm", "cb");
  });

  it("should resolve requestTelegramContact when granted", async () => {
    const res = await requestTelegramContact();
    expect(res).toBe(true);
  });
});

describe("Telegram initialization flows", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("should return registered status when check succeeds", async () => {
    authService.telegramCheck.mockResolvedValueOnce({
      data: { data: { status: "registered", phone_number: "+123" } },
    });

    const res = await initTelegramApp();
    expect(res.status).toBe("registered");
    expect(res.phone_number).toBe("+123");
    expect(res.start_param).toBe("restaurant_123");
  });

  it("should return error status when check throws", async () => {
    authService.telegramCheck.mockRejectedValueOnce(new Error("Failed"));

    const res = await initTelegramApp();
    expect(res.status).toBe("error");
  });

  it("should completeTelegramAuth", async () => {
    authService.telegramRegister.mockResolvedValueOnce({
      data: { data: { access_token: "acc", refresh_token: "ref" } },
    });

    const res = await completeTelegramAuth("init", "+123", "Name");
    expect(res.access_token).toBe("acc");
    expect(sessionStorage.getItem("access_token")).toBe("acc");
    expect(sessionStorage.getItem("refresh_token")).toBe("ref");
  });

  it("should authExistingUser", async () => {
    authService.telegramAuth.mockResolvedValueOnce({
      data: { data: { access_token: "acc", refresh_token: "ref" } },
    });

    const res = await authExistingUser("init");
    expect(res.access_token).toBe("acc");
    expect(sessionStorage.getItem("access_token")).toBe("acc");
    expect(sessionStorage.getItem("refresh_token")).toBe("ref");
  });
});
