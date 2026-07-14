import type { Badge } from "../../types";

export function badgeInstanceKey(badge: Badge, index: number): string {
  return badge._id ?? `${badge.badgeId?._id ?? "badge"}-${index}`;
}
