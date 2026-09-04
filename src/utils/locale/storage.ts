// storage.ts
// localStorage wybranego języka przed odpowiedzią profilu.
// Zakres:
//  - klucz per apka
//  - język UI przed odpowiedzią profilu; logout nie czyści
// Logout nie musi czyścić — język UI może zostać.
// Przy zmianach: LocaleContext.tsx.

import { DEFAULT_LOCALE, type AppLocale } from "../../languages";

const STORAGE_KEY = "klovy.locale";

export function readStoredLocale(): AppLocale | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "pl" || raw === "en") return raw;
    return null;
  } catch {
    return null;
  }
}

export function loadStoredLocale(): AppLocale {
  return readStoredLocale() ?? DEFAULT_LOCALE;
}

export function saveStoredLocale(locale: AppLocale): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {

  }
}

export function applyDocumentLocale(locale: AppLocale): void {
  if (typeof document === "undefined") return;
  document.documentElement.lang = locale;
}

export { STORAGE_KEY };
