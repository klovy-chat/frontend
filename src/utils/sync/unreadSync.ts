type Listener = (count: number) => void;

const BASE_KEY = "klovy_unread_count_v1";
let activeUserId: string | null = null;
/** Full muted-filtered total (includes open-chat unread). */
let fullCount = 0;
/** This tab's open-chat unread — subtracted only locally for document.title. */
let localTitleExclude = 0;
let currentCount = 0;
const listeners: Listener[] = [];

function storageKey(userId: string | null): string {
  return userId ? `${BASE_KEY}:${userId}` : BASE_KEY;
}

const bc =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel(BASE_KEY)
    : null;

function displayCount(): number {
  return Math.max(0, fullCount - localTitleExclude);
}

function notify() {
  currentCount = displayCount();
  listeners.forEach((l) => {
    try {
      l(currentCount);
    } catch {
      /**/
    }
  });
}

function readFromStorage(userId: string | null): number {
  try {
    const v = localStorage.getItem(storageKey(userId));
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

fullCount = typeof window !== "undefined" ? readFromStorage(null) : 0;
currentCount = fullCount;

if (bc) {
  bc.onmessage = (ev) => {
    const payload = ev.data as { userId?: string | null; count?: number } | null;
    if (!payload || typeof payload.count !== "number") return;
    const msgUser =
      typeof payload.userId === "string" || payload.userId === null
        ? payload.userId
        : null;
    if (msgUser !== activeUserId) return;
    if (payload.count === fullCount) return;
    fullCount = payload.count;
    try {
      localStorage.setItem(storageKey(activeUserId), String(fullCount));
    } catch {
      /**/
    }
    notify();
  };
} else if (typeof window !== "undefined") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== storageKey(activeUserId)) return;
    const v = e.newValue ? parseInt(e.newValue, 10) || 0 : 0;
    if (v === fullCount) return;
    fullCount = v;
    notify();
  });
}

/** Bind badge storage to the logged-in user (call on login / session restore). */
function setUserId(userId: string | null) {
  if (userId === activeUserId) return;
  activeUserId = userId;
  fullCount = typeof window !== "undefined" ? readFromStorage(userId) : 0;
  localTitleExclude = 0;
  notify();
}

/**
 * Set full muted-filtered unread total (includes open chat).
 * Broadcasts full total; each tab subtracts its own localTitleExclude for title.
 */
function setCount(n: number, broadcast = true) {
  const normalized = Math.max(0, Math.floor(n || 0));
  if (normalized === fullCount) {
    const next = displayCount();
    if (next !== currentCount) notify();
    return;
  }
  fullCount = normalized;
  try {
    const key = storageKey(activeUserId);
    localStorage.setItem(key, String(fullCount));
    if (broadcast && bc) {
      bc.postMessage({ userId: activeUserId, count: fullCount });
    }
  } catch {
    /**/
  }
  notify();
}

/** Open-chat unread to hide from this tab's document.title only (not BC). */
function setLocalTitleExclude(n: number) {
  const normalized = Math.max(0, Math.floor(n || 0));
  if (normalized === localTitleExclude) return;
  localTitleExclude = normalized;
  notify();
}

/**
 * Atomically update full count + local title exclude (one notify).
 * Use on Chat→Settings heal so exclude(0) cannot flash open-chat into the title.
 */
function setCountAndLocalExclude(
  count: number,
  exclude: number,
  broadcast = true,
) {
  const nextCount = Math.max(0, Math.floor(count || 0));
  const nextExclude = Math.max(0, Math.floor(exclude || 0));
  const countChanged = nextCount !== fullCount;
  const excludeChanged = nextExclude !== localTitleExclude;
  if (!countChanged && !excludeChanged) {
    const next = displayCount();
    if (next !== currentCount) notify();
    return;
  }
  fullCount = nextCount;
  localTitleExclude = nextExclude;
  try {
    const key = storageKey(activeUserId);
    localStorage.setItem(key, String(fullCount));
    if (broadcast && countChanged && bc) {
      bc.postMessage({ userId: activeUserId, count: fullCount });
    }
  } catch {
    /**/
  }
  notify();
}

function getCount(): number {
  return currentCount;
}

/** Full muted-filtered total before local title exclude (for remount handoff). */
function getFullCount(): number {
  return fullCount;
}

function resetCount(opts?: { broadcast?: boolean }) {
  fullCount = 0;
  localTitleExclude = 0;
  currentCount = 0;
  try {
    localStorage.removeItem(storageKey(activeUserId));
    // Logout/teardown must not zero other same-user tabs' title.
    if (opts?.broadcast !== false && bc) {
      bc.postMessage({ userId: activeUserId, count: 0 });
    }
  } catch {
    /**/
  }
  notify();
}

function onChange(fn: Listener) {
  listeners.push(fn);
  try {
    fn(currentCount);
  } catch {
    /**/
  }
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export default {
  setUserId,
  setCount,
  setLocalTitleExclude,
  setCountAndLocalExclude,
  getCount,
  getFullCount,
  resetCount,
  onChange,
};
