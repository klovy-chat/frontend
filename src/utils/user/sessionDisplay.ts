import i18n from "../../i18n/config";

export function normalizeSessionBrowser(browser: string): string {
  const normalized = browser.trim().toLowerCase();
  if (normalized.includes("opera")) return "Opera";
  if (normalized.includes("brave")) return "Brave";
  if (normalized.includes("vivaldi")) return "Vivaldi";
  if (normalized.includes("firefox") || normalized.includes("fxios")) return "Firefox";
  if (normalized.includes("edg")) return "Edge";
  if (
    normalized.includes("chrome")
    || normalized.includes("chromium")
    || normalized.includes("crios")
  ) {
    return "Chrome";
  }
  if (normalized.includes("safari")) return "Safari";
  if (normalized.includes("stoat")) {
    if (normalized.includes("android")) return "Stoat For Android";
    if (normalized.includes("ios")) return "Stoat IOS";
    return "Stoat For Web";
  }
  return browser.trim();
}

export function formatSessionRelativeTime(value: string | null): string {
  if (!value) return i18n.t("common.emDash");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return i18n.t("common.emDash");

  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return i18n.t("user.sessionRelative.justNow");
  if (minutes < 60) {
    return i18n.t("user.sessionRelative.minutes", { count: minutes });
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return i18n.t("user.sessionRelative.hours", { count: hours });
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return i18n.t("user.sessionRelative.days", { count: days });
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return i18n.t("user.sessionRelative.months", { count: months });
  }

  const years = Math.floor(months / 12);
  return i18n.t("user.sessionRelative.years", { count: years });
}
