// index.ts
// Locale formatowania dat vs język UI (mogą się rozjechać).
// Zakres:
//  - region przeglądarki, fallback do języka apki
//  - locale dat vs język UI — mogą się rozjechać
// Nowy język UI to osobna sprawa niż format daty.
// Przy zmianach: i18n/config.ts, LocaleContext.tsx.

export const SUPPORTED_LOCALES = ["pl", "en"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "pl";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  pl: "Polski",
  en: "English",
};

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "pl" || value === "en";
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  return value === "en" ? "en" : "pl";
}

function getDateLocale(locale: AppLocale): string {
  return locale === "en" ? "en-US" : "pl-PL";
}

export function getFormattingLocale(appLocale?: AppLocale): string {
  if (typeof navigator !== "undefined") {
    const browserLocale = navigator.language?.trim();
    if (browserLocale) return browserLocale;
  }
  return getDateLocale(appLocale ?? DEFAULT_LOCALE);
}
