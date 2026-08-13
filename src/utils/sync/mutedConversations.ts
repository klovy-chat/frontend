/** Shared muted conversation keys so shell bridges respect mute off Chat. */

type Listener = () => void;

const MUTE_BC_KEY = "klovy:mutedConversations";
const MUTE_STORAGE_BASE = "klovy:mutedConversations:v1";
/** Guard HTTP lag after local mute/unmute (ms). */
const MUTE_GUARD_MS = 60_000;

let activeUserId: string | null = null;
const mutedKeys = new Set<string>();
/** Local/BC unmute — stale HTTP isMuted:true must not remute. */
const unmuteGuardUntil = new Map<string, number>();
/** Local mute — stale HTTP unmuted must not wipe until server catches up. */
const muteGuardUntil = new Map<string, number>();
const listeners = new Set<Listener>();

const bc =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel(MUTE_BC_KEY)
    : null;

function storageKey(userId: string | null): string | null {
  return userId ? `${MUTE_STORAGE_BASE}:${userId}` : null;
}

function notify() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

function sameKeySet(keys: string[]): boolean {
  if (keys.length !== mutedKeys.size) return false;
  for (const k of keys) {
    if (!mutedKeys.has(k)) return false;
  }
  return true;
}

function applyKeys(keys: Iterable<string>) {
  const list = [...keys];
  if (sameKeySet(list)) return false;
  mutedKeys.clear();
  for (const k of list) mutedKeys.add(k);
  notify();
  return true;
}

function persistLocal(keys: string[]) {
  const key = storageKey(activeUserId);
  if (!key) return;
  try {
    localStorage.setItem(key, JSON.stringify(keys));
  } catch {
    /* private mode */
  }
}

function loadLocal(userId: string | null) {
  const key = storageKey(userId);
  if (!key) {
    applyKeys([]);
    return;
  }
  try {
    // One-time migrate from pre-user-scoped key.
    let raw = localStorage.getItem(key);
    if (!raw) {
      const legacy = localStorage.getItem(MUTE_STORAGE_BASE);
      if (legacy) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(MUTE_STORAGE_BASE);
        raw = legacy;
      }
    }
    if (!raw) {
      applyKeys([]);
      return;
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      applyKeys([]);
      return;
    }
    applyKeys(parsed.filter((k): k is string => typeof k === "string"));
  } catch {
    applyKeys([]);
  }
}

function syncGuardsFromTransition(prev: Set<string>, next: Set<string>) {
  const now = Date.now();
  for (const k of prev) {
    if (!next.has(k)) {
      unmuteGuardUntil.set(k, now + MUTE_GUARD_MS);
      muteGuardUntil.delete(k);
    }
  }
  for (const k of next) {
    if (!prev.has(k)) {
      muteGuardUntil.set(k, now + MUTE_GUARD_MS);
      unmuteGuardUntil.delete(k);
    }
  }
}

function applyRemoteKeys(userId: string | null, list: string[]) {
  if (userId !== activeUserId) return;
  const prev = new Set(mutedKeys);
  const next = new Set(list);
  syncGuardsFromTransition(prev, next);
  applyKeys(list);
}

if (bc) {
  bc.onmessage = (ev) => {
    const payload = ev.data as { userId?: string | null; keys?: unknown } | unknown;
    if (Array.isArray(payload)) {
      // Legacy BC without userId — ignore (avoid cross-account bleed).
      return;
    }
    if (!payload || typeof payload !== "object") return;
    const { userId, keys } = payload as { userId?: string | null; keys?: unknown };
    if (!Array.isArray(keys)) return;
    applyRemoteKeys(
      typeof userId === "string" || userId === null ? userId : null,
      keys.filter((k): k is string => typeof k === "string"),
    );
  };
} else if (typeof window !== "undefined") {
  window.addEventListener("storage", (e: StorageEvent) => {
    const key = storageKey(activeUserId);
    if (!key || e.key !== key || e.newValue == null) return;
    try {
      const parsed = JSON.parse(e.newValue) as unknown;
      if (!Array.isArray(parsed)) return;
      applyRemoteKeys(
        activeUserId,
        parsed.filter((k): k is string => typeof k === "string"),
      );
    } catch {
      /* ignore */
    }
  });
}

/** Bind mute persistence to the logged-in user (login / session restore). */
export function setMutedConversationsUserId(userId: string | null) {
  if (userId === activeUserId) return;
  activeUserId = userId;
  unmuteGuardUntil.clear();
  muteGuardUntil.clear();
  loadLocal(userId);
}

/**
 * Authoritative replace (toggle / full sync with broadcast).
 * Sets mute/unmute guards from the transition.
 */
export function setMutedConversationKeys(
  keys: Iterable<string>,
  opts?: { broadcast?: boolean; skipGuards?: boolean },
) {
  const list = [...keys];
  const prev = new Set(mutedKeys);
  const next = new Set(list);
  // Logout/teardown must not arm unmute guards on other same-user tabs.
  if (!opts?.skipGuards) syncGuardsFromTransition(prev, next);
  const changed = applyKeys(list);
  if (changed) persistLocal(list);
  if (opts?.broadcast === false) return;
  try {
    if (bc) bc.postMessage({ userId: activeUserId, keys: list });
  } catch {
    /* ignore */
  }
}

/**
 * HTTP roster mute sync — store + guards are SoT for recent toggles.
 * Never remute unmute-guarded keys; never drop mute-guarded keys on stale HTTP.
 */
export function mergeMutedFromHttp(
  httpMutedKeys: Iterable<string>,
  rosterIds: Iterable<string>,
) {
  // Do not time-prune guards here — keep until HTTP agrees (lag > MUTE_GUARD_MS).
  const roster = new Set(rosterIds);
  const httpMuted = new Set(
    [...httpMutedKeys].filter((k) => roster.has(k)),
  );
  // Server caught up — clear matching guards. Off-roster: drop sticky guards
  // so rejoin + HTTP muted can remute (no forever unmute/mute lag).
  for (const k of [...unmuteGuardUntil.keys()]) {
    if (!roster.has(k) || !httpMuted.has(k)) unmuteGuardUntil.delete(k);
  }
  for (const k of [...muteGuardUntil.keys()]) {
    if (!roster.has(k) || httpMuted.has(k)) muteGuardUntil.delete(k);
  }

  const next = new Set<string>();
  for (const id of roster) {
    // Sticky until HTTP matches — ignore TTL during merge.
    if (unmuteGuardUntil.has(id)) continue;
    if (httpMuted.has(id)) {
      next.add(id);
      continue;
    }
    // HTTP unmuted — keep only if local mute still guarded (lag).
    if (mutedKeys.has(id) && muteGuardUntil.has(id)) {
      next.add(id);
    }
  }

  const list = [...next];
  const changed = applyKeys(list);
  if (changed) persistLocal(list);
}

export function getMutedConversationKeys(): string[] {
  return [...mutedKeys];
}

/** Store is source of truth for mute display (not HTTP||local). */
export function isConversationMuted(kind: "dm" | "channel", id: string): boolean {
  return mutedKeys.has(`${kind}:${id}`);
}

export function subscribeMutedConversations(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
