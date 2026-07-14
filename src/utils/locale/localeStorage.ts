import { DEFAULT_LOCALE, normalizeLocale, type AppLocale } from "../../languages";

const STORAGE_KEY = "klovy.locale";

export function loadStoredLocale(): AppLocale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    return normalizeLocale(localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function saveStoredLocale(locale: AppLocale): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore quota / private mode
  }
}

export function applyDocumentLocale(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

export { STORAGE_KEY };
