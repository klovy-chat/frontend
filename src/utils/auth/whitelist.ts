// whitelist.ts
// Czy user czeka na akceptację (pending).
// Zakres:
//  - router → /pending
//  - pending → /pending z flagi /me
// Flaga z /me musi zgadzać się z user.isWhitelisted na BE.
// Przy zmianach: App.tsx, utils/whitelist/mod.rs.

import type { User } from "../../types";

export function isPendingWhitelist(user: User): boolean {
  if (user.isWhitelistEnabled !== true) return false;
  return !user.isWhitelisted;
}
