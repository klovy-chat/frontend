// moderation.ts
// Czy user jest mute/ban w kanale (wpisy z wygaśnięciem).
// Zakres:
//  - UI listy członków i composera
//  - mute/ban z wygaśnięciem — UI listy i composera
// Format wpisu jak channel_moderation.rs (timed vs permanent).
// Przy zmianach: ChannelSettings.tsx, model/channel_moderation.rs.

import i18n from "../../i18n/config";
import { getFormattingLocale, normalizeLocale } from "../../languages";

function formattingLocale(): string {
  return getFormattingLocale(normalizeLocale(i18n.language));
}

export const CHANNEL_MOD_DURATION_OPTIONS = [
  { label: i18n.t("moderation.duration.min5"), seconds: 300 },
  { label: i18n.t("moderation.duration.min15"), seconds: 900 },
  { label: i18n.t("moderation.duration.min30"), seconds: 1800 },
  { label: i18n.t("moderation.duration.hour1"), seconds: 3600 },
  { label: i18n.t("moderation.duration.hours6"), seconds: 21600 },
  { label: i18n.t("moderation.duration.hours24"), seconds: 86400 },
  { label: i18n.t("moderation.duration.days7"), seconds: 604800 },
  { label: i18n.t("moderation.permanent"), seconds: 0 },
] as const;

export function formatModerationExpiry(
  expiresAt?: string | null,
  permanent?: boolean,
): string {
  if (permanent || !expiresAt) return i18n.t("moderation.permanent");
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return i18n.t("moderation.permanent");
  if (date.getTime() <= Date.now()) return i18n.t("moderation.expired");
  const formatted = date.toLocaleString(formattingLocale(), {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  return i18n.t("moderation.until", { date: formatted });
}
