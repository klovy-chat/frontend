type Listener = (count: number) => void;

const KEY = "klovy_unread_count_v1";
let currentCount = 0;
const listeners: Listener[] = [];

const bc = typeof window !== "undefined" && "BroadcastChannel" in window
  ? new BroadcastChannel(KEY)
  : null;

function notify() {
  listeners.forEach((l) => {
    try { l(currentCount); } catch { /**/ }
  });
}

function readFromStorage(): number {
  try {
    const v = localStorage.getItem(KEY);
    return v ? parseInt(v, 10) || 0 : 0;
  } catch {
    return 0;
  }
}

currentCount = typeof window !== "undefined" ? readFromStorage() : 0;

if (bc) {
  bc.onmessage = (ev) => {
    const payload = ev.data as { count?: number } | null;
    if (!payload || typeof payload.count !== "number") return;
    if (payload.count === currentCount) return;
    currentCount = payload.count;
    notify();
  };
} else if (typeof window !== "undefined") {
  window.addEventListener("storage", (e: StorageEvent) => {
    if (e.key !== KEY) return;
    const v = e.newValue ? parseInt(e.newValue, 10) || 0 : 0;
    if (v === currentCount) return;
    currentCount = v;
    notify();
  });
}

function setCount(n: number, broadcast = true) {
  const normalized = Math.max(0, Math.floor(n || 0));
  if (normalized === currentCount) return;
  currentCount = normalized;
  try {
    if (broadcast) {
      if (bc) bc.postMessage({ count: currentCount });
      else localStorage.setItem(KEY, String(currentCount));
    } else {
      localStorage.setItem(KEY, String(currentCount));
    }
  } catch {
    /**/
  }
  notify();
}

function onChange(fn: Listener) {
  listeners.push(fn);
  try { fn(currentCount); } catch { /**/ }
  return () => {
    const i = listeners.indexOf(fn);
    if (i >= 0) listeners.splice(i, 1);
  };
}

export default { setCount, onChange };
