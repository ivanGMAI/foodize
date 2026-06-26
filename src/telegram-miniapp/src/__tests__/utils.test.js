import { describe, it, expect } from "vitest";
import { ORDER_STATUS_RU, translate } from "../utils/locales";
import { hasPermission } from "../utils/permissions";
import { translateApiError } from "../utils/translateApiError";

describe("locales translate utility", () => {
  it("should translate order status", () => {
    expect(translate(ORDER_STATUS_RU, "PENDING")).toBe("Ожидается");
    expect(translate(ORDER_STATUS_RU, "UNKNOWN")).toBe("UNKNOWN");
    expect(translate(ORDER_STATUS_RU, null, "fallback")).toBe("fallback");
  });
});

describe("permissions utility", () => {
  it("should check user permissions", () => {
    const user = { permissions: ["admin.access", "other"] };
    expect(hasPermission(user, "admin.access")).toBe(true);
    expect(hasPermission(user, "missing")).toBe(false);
    expect(hasPermission(null, "admin.access")).toBe(false);
    expect(hasPermission({}, "admin.access")).toBe(false);
  });
});

describe("translateApiError utility", () => {
  it("should translate exact error message", () => {
    const err = { response: { data: { detail: "Invalid credentials" } } };
    expect(translateApiError(err, "fallback")).toBe("Неверный телефон или пароль");
  });

  it("should translate prefixed error message", () => {
    const err = { response: { data: { detail: "You can publish up to 5 reviews for one restaurant: extra details" } } };
    expect(translateApiError(err, "fallback")).toBe("Можно опубликовать до 5 отзывов на один ресторан");
  });

  it("should return fallback or detail if untranslatable", () => {
    const err = { response: { data: { detail: "Strange error" } } };
    expect(translateApiError(err, "fallback")).toBe("fallback");
    expect(translateApiError(err, null)).toBe("Strange error");
    expect(translateApiError({}, "fallback")).toBe("fallback");
  });
});
