import i18n from "../../i18n/config";

export type AvailabilityStatus = "online" | "away" | "brb" | "dnd" | "offline";

export const PRESENCE_COLORS: Record<AvailabilityStatus, string> = {
  online: "#4CD964",
  away: "#8E8E93",
  brb: "#FF9500",
  dnd: "#FF3B30",
  offline: "#8E8E93",
};

function effectivePresenceStatus(entity: {
  isOnline?: boolean;
  availabilityStatus?: "online" | "away" | "brb" | "dnd";
}): AvailabilityStatus {
  if (!entity.isOnline) return "offline";
  return entity.availabilityStatus ?? "online";
}

export function getEffectiveStatus(entity: {
  isOnline?: boolean;
  availabilityStatus?: "online" | "away" | "brb" | "dnd";
}): AvailabilityStatus {
  return effectivePresenceStatus(entity);
}

export function presenceColor(entity: {
  isOnline?: boolean;
  availabilityStatus?: "online" | "away" | "brb" | "dnd";
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
