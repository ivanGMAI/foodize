export const tg = window.Telegram?.WebApp ?? null;

export const TELEGRAM_INIT_DATA_STORAGE_KEY = "foodize_tg_init_data";

export function getTelegramInitData() {
  const initData = tg?.initData ?? "";
  if (initData) {
    sessionStorage.setItem(TELEGRAM_INIT_DATA_STORAGE_KEY, initData);
    return initData;
  }

  return sessionStorage.getItem(TELEGRAM_INIT_DATA_STORAGE_KEY) ?? "";
}

export function getTelegramUser() {
  return tg?.initDataUnsafe?.user ?? null;
}

export function getStartParam() {
  return tg?.initDataUnsafe?.start_param ?? "";
}

export function expandApp() {
  tg?.expand();
}

export function readyApp() {
  tg?.ready();
}

export function getColorScheme() {
  return tg?.colorScheme ?? "light";
}

export function getThemeParams() {
  return tg?.themeParams ?? {};
}

export function closeApp() {
  tg?.close();
}

export function showAlert(message, callback) {
  tg?.showAlert(message, callback);
}

export function showConfirm(message, callback) {
  tg?.showConfirm(message, callback);
}

export function requestTelegramContact() {
  return new Promise((resolve, reject) => {
    if (!tg?.requestContact) {
      reject(new Error("Telegram contact request is not available"));
      return;
    }

    tg.requestContact((granted) => {
      resolve(Boolean(granted));
    });
  });
}

export const BackButton = tg?.BackButton ?? null;
export const MainButton = tg?.MainButton ?? null;
export const HapticFeedback = tg?.HapticFeedback ?? null;
