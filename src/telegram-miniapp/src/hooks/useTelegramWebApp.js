import {
  BackButton,
  HapticFeedback,
  MainButton,
  getColorScheme,
  tg,
} from "../telegram/sdk";

export function useTelegramWebApp() {
  return {
    tg,
    colorScheme: getColorScheme(),
    BackButton,
    MainButton,
    HapticFeedback,
    close: () => tg?.close(),
    showAlert: (msg, cb) => tg?.showAlert(msg, cb),
    showConfirm: (msg, cb) => tg?.showConfirm(msg, cb),
  };
}
