// friendsCache.ts
// Mapa friend/block do composera bez roundtripu.
// Zakres:
//  - subscribe + patch
//  - mapa friend/block dla composera bez roundtripu
// Po każdej mutacji friends API wołaj patch, nie tylko refetch okna.
// Przy zmianach: FriendsCache.tsx, api/friends.ts.

export type FriendshipCacheEntry = {
  isFriend: boolean;
  isBlockedByMe: boolean;
  isBlockedByOther: boolean;
  at: number;
};

const FRIENDSHIP_CACHE_MS = 60_000;
const friendshipCache = new Map<string, FriendshipCacheEntry>();
let friendshipEpoch = 0;
const friendshipListeners = new Set<() => void>();

export function getFriendshipEpoch(): number {
  return friendshipEpoch;
}

export function subscribeFriendshipInvalidation(listener: () => void): () => void {
  friendshipListeners.add(listener);
  return () => {
    friendshipListeners.delete(listener);
  };
}

function bumpFriendshipEpoch() {
  friendshipEpoch += 1;
  for (const listener of friendshipListeners) {
    try {
      listener();
    } catch {
      /* ignore */
    }
  }
}

export function getCachedFriendship(
  contactId: string,
): FriendshipCacheEntry | undefined {
  const cached = friendshipCache.get(contactId);
  if (!cached) return undefined;
  if (Date.now() - cached.at >= FRIENDSHIP_CACHE_MS) {
    friendshipCache.delete(contactId);
    return undefined;
  }
  return cached;
}

export function setCachedFriendship(
  contactId: string,
  entry: Omit<FriendshipCacheEntry, "at">,
) {
  friendshipCache.set(contactId, { ...entry, at: Date.now() });
}

export function patchCachedFriendship(
  contactId: string,
  patch: Partial<Omit<FriendshipCacheEntry, "at">>,
) {
  const cached = getCachedFriendship(contactId);
  if (!cached) {
    invalidateFriendshipCache(contactId);
    return;
  }
  friendshipCache.set(contactId, {
    isFriend: patch.isFriend ?? cached.isFriend,
    isBlockedByMe: patch.isBlockedByMe ?? cached.isBlockedByMe,
    isBlockedByOther: patch.isBlockedByOther ?? cached.isBlockedByOther,
    at: Date.now(),
  });
  bumpFriendshipEpoch();
}

export function invalidateFriendshipCache(contactId?: string) {
  if (contactId) {
    friendshipCache.delete(contactId);
  } else {
    friendshipCache.clear();
  }
  bumpFriendshipEpoch();
}
