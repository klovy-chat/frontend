// hangup.ts
// Kolejka hangup/leave na unload (sync persist, potem flush).
// Zakres:
//  - jedno DM hangup na peer, channel_leave osobno
//  - generation gasi stary flush
// CallContext musi kolejkować zanim WS padnie.
// Przy zmianach: CallContext.tsx, utils/voice/calls.rs.

export type PendingHangup =
  | { kind: "call_end"; from: string; to: string }
  | { kind: "call_cancel"; from: string; to: string }
  | { kind: "call_timeout"; from: string; to: string }
  | { kind: "call_reject"; from: string; to: string }
  | { kind: "channel_leave"; channelId: string };

const STORAGE_KEY = "klovy:pendingHangup";

const MAX_QUEUE = 8;

let queue: PendingHangup[] = [];

let generation = 0;

function sameTarget(a: PendingHangup, b: PendingHangup): boolean {
  if (a.kind === "channel_leave" && b.kind === "channel_leave") {
    return a.channelId === b.channelId;
  }

  if (a.kind !== "channel_leave" && b.kind !== "channel_leave") {
    return a.from === b.from && a.to === b.to;
  }
  return false;
}

function persist() {
  try {
    if (queue.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {

  }
}

function load() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as PendingHangup | PendingHangup[];
    if (Array.isArray(parsed)) {
      queue = parsed.filter(
        (h) => h && typeof h === "object" && "kind" in h,
      );
    } else if (parsed && typeof parsed === "object" && "kind" in parsed) {
      queue = [parsed];
    }
  } catch {
    /* ignore */
  }
}

load();

export function queuePendingHangupSync(hangup: PendingHangup) {
  generation += 1;

  queue = queue.filter((h) => !sameTarget(h, hangup));
  queue.push(hangup);
  if (queue.length > MAX_QUEUE) {
    queue = queue.slice(-MAX_QUEUE);
  }
  persist();
}

export function peekAllPendingHangups(): PendingHangup[] {
  return queue.slice();
}

export function getPendingHangupGeneration(): number {
  return generation;
}

export function takePendingHangup(): PendingHangup | null {
  const h = queue[0] ?? null;
  if (!h) return null;
  queue = queue.slice(1);
  persist();
  return h;
}

export function clearPendingHangup() {
  generation += 1;
  queue = [];
  persist();
}

export function clearMatchingHangup(hangup: PendingHangup) {
  queue = queue.filter((h) => !sameTarget(h, hangup));
  persist();
}
