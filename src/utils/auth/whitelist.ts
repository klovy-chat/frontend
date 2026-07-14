import type { User } from "../../types";

/** Konto czeka na zatwierdzenie tylko gdy whitelist jest włączona na serwerze. */
export function isPendingWhitelist(user: User): boolean {
  if (user.isWhitelistEnabled !== true) return false;
  return !user.isWhitelisted;
}
