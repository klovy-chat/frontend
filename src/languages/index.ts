// index.ts
// Locale formatowania dat vs język UI (mogą się rozjechać).
// Zakres:
//  - region przeglądarki, fallback do języka apki
//  - locale dat vs język UI — mogą się rozjechać
// Nowy język UI to osobna sprawa niż format daty.
// Przy zmianach: i18n/config.ts, LocaleContext.tsx.

const AVAILABLE_LOCALES = ["en", "pl", "ru"] as const;

export type AppLocale = (typeof AVAILABLE_LOCALES)[number];

export const SUPPORTED_LOCALES: readonly AppLocale[] = AVAILABLE_LOCALES.filter(locale => locale !== "ru");

export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  pl: "Polski",
  ru: "Русский",
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return SUPPORTED_LOCALES.some(locale => locale === value);
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  if (!value) return DEFAULT_LOCALE;
  const base = value.toLowerCase().split("-")[0];
  return isAppLocale(base) ? base : DEFAULT_LOCALE;
}

function getDateLocale(locale: AppLocale): string {
  return { en: "en-US", pl: "pl-PL", ru: "ru-RU" }[locale];
}

export function getFormattingLocale(appLocale?: AppLocale): string {
  if (typeof navigator !== "undefined") {
    const browserLocale = navigator.language?.trim();
    if (browserLocale) return browserLocale;
  }
  return getDateLocale(appLocale ?? DEFAULT_LOCALE);
}
