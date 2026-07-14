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

export function getDateLocale(locale: AppLocale): string {
  return locale === "en" ? "en-US" : "pl-PL";
}
