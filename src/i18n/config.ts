// config.ts
// i18next — przełączanie PL/EN.
// Zakres:
//  - inicjalizacja instancji używanej w main.tsx
//  - inicjalizacja i18next; stringi w languages/*.json
// Stringi trzymaj w languages/*.json, nie w JSX.
// Przy zmianach: languages/index.ts, scripts/build-locales.mjs.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import pl from "../languages/pl.json";
import en from "../languages/en.json";
import ru from "../languages/ru.json";
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, normalizeLocale, type AppLocale } from "../languages";
import { applyDocumentLocale, loadStoredLocale } from "../utils/locale/storage";

const initialLocale = loadStoredLocale();
applyDocumentLocale(initialLocale);

void i18n.use(initReactI18next).init({
  resources: {
    pl: { translation: pl },
    en: { translation: en },
    ru: { translation: ru },
  },
  lng: initialLocale,
  supportedLngs: [...SUPPORTED_LOCALES],
  fallbackLng: DEFAULT_LOCALE,
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export function changeAppLanguage(locale: AppLocale): void {
  const normalized = normalizeLocale(locale);
  void i18n.changeLanguage(normalized);
  applyDocumentLocale(normalized);
}

export default i18n;
