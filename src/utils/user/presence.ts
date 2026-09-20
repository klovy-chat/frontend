// presence.ts
// Pomocnicze mapowanie technicznej obecności na kolor UI.
// Zakres:
//  - online/offline; live jest w PresenceContext
// Źródło live: PresenceContext, nie ten plik.
// Przy zmianach: PresenceContext.tsx, notifySound.ts.

import i18n from "../../i18n/config";

export type AvailabilityStatus = "online" | "offline";

export const PRESENCE_COLORS: Record<AvailabilityStatus, string> = {
  online: "#4CD964",
  offline: "#8E8E93",
};

function effectivePresenceStatus(entity: {
  isOnline?: boolean;
}): AvailabilityStatus {
  return entity.isOnline ? "online" : "offline";
}

export function getEffectiveStatus(entity: {
  isOnline?: boolean;
}): AvailabilityStatus {
  return effectivePresenceStatus(entity);
}

export function presenceColor(entity: {
  isOnline?: boolean;
}): string {
  return PRESENCE_COLORS[effectivePresenceStatus(entity)];
}

export function channelMemberCount(channel: {
  members?: unknown[] | null;
  memberCount?: number | null;
}): number {
  if (typeof channel.memberCount === "number" && channel.memberCount > 0) {
    return channel.memberCount;
  }
  return (channel.members?.length ?? 0) + 1;
}

export function channelMemberCountLabel(count: number): string {
  return i18n.t("user.memberCount", { count });
}
