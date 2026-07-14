import type { WarningSeverity } from "../../api/auth";
import i18n from "../../i18n/config";
import { getDateLocale, normalizeLocale } from "../../languages";

function dateLocale(): string {
  return getDateLocale(normalizeLocale(i18n.language));
}

export function warningSeverityLabel(severity: WarningSeverity): string {
  return i18n.t(`user.warningSeverity.${severity}`);
}

export const WARNING_SEVERITY_LABELS = new Proxy(
  {} as Record<WarningSeverity, string>,
  {
    get(_target, prop: string) {
      return warningSeverityLabel(prop as WarningSeverity);
    },
  },
);

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return date.toLocaleTimeString(dateLocale(), {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return date.toLocaleDateString(dateLocale(), {
    day: "numeric",
    month: "short",
  });
}

export type UserLabelSource = {
  displayName?: string | null;
  username?: string;
};

/** Główna nazwa widoczna w UI: displayName → @username */
export function userLabel(user?: UserLabelSource | null): string {
  if (!user) return i18n.t("user.defaultLabel");
  if (user.displayName?.trim()) return user.displayName.trim();
  return user.username ? `@${user.username}` : i18n.t("user.defaultLabel");
}

export function formatJoinedDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(dateLocale(), {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function getUserId(user: { _id?: string; id?: string } | string): string {
  if (typeof user === "string") return user;
  return user._id ?? user.id ?? "";
}

export type AvailabilityStatus = "online" | "away" | "brb" | "dnd" | "offline";

export function availabilityStatusLabel(status: AvailabilityStatus): string {
  return i18n.t(`user.availability.${status}`, {
    defaultValue: i18n.t("user.availability.offline"),
  });
}

export function formatLiveDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const time = date.toLocaleTimeString(dateLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${day}.${month}.${year} · ${time}`;
}
