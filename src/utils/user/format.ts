// format.ts
// Jedna etykieta osoby: displayName albo @username.
// Zakres:
//  - getUserId helper
//  - displayName albo @username; getUserId helper
// Nie składaj nazwy ad-hoc w dymku — tu łatwiej i18n/fallback.
// Przy zmianach: MessageBubble.tsx, ChatList.tsx.

import type { WarningSeverity } from "../../api/auth";
import i18n from "../../i18n/config";
import { getFormattingLocale, normalizeLocale } from "../../languages";

function formattingLocale(): string {
  return getFormattingLocale(normalizeLocale(i18n.language));
}

function formatClockTime(date: Date, withSeconds = false): string {
  return date.toLocaleTimeString(formattingLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    ...(withSeconds ? { second: "2-digit" } : {}),
  });
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

export function formatMessageTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return i18n.t("common.emDash");
  return formatClockTime(date);
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return i18n.t("common.emDash");

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) {
    return formatClockTime(date);
  }

  return date.toLocaleDateString(formattingLocale(), {
    day: "numeric",
    month: "short",
  });
}

function localDayKey(date: Date): string {
  return [
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ].join("-");
}

export function isSameLocalDay(a: string | Date, b: string | Date): boolean {
  const dateA = a instanceof Date ? a : new Date(a);
  const dateB = b instanceof Date ? b : new Date(b);
  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) {
    return false;
  }
  return localDayKey(dateA) === localDayKey(dateB);
}

export function formatMessageDateSeparator(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return i18n.t("common.emDash");

  const now = new Date();
  if (isSameLocalDay(date, now)) {
    return i18n.t("common.today");
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameLocalDay(date, yesterday)) {
    return i18n.t("common.yesterday");
  }

  return date.toLocaleDateString(formattingLocale(), {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

export type UserLabelSource = {
  displayName?: string | null;
  username?: string;
};

export function userLabel(user?: UserLabelSource | null): string {
  if (!user) return i18n.t("user.defaultLabel");
  if (user.displayName?.trim()) return user.displayName.trim();
  return user.username ? `@${user.username}` : i18n.t("user.defaultLabel");
}

export function formatJoinedDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(formattingLocale(), {
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
  const locale = formattingLocale();
  const datePart = date.toLocaleDateString(locale, {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
  const timePart = formatClockTime(date, true);
  return `${datePart} · ${timePart}`;
}
