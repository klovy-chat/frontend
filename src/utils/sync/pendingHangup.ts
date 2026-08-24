/** Pending hangup/cancel/leave for unload — sync persist before async encrypt. */

export type PendingHangup =
  | { kind: "call_end"; from: string; to: string }
  | { kind: "call_cancel"; from: string; to: string }
  | { kind: "call_timeout"; from: string; to: string }
  | { kind: "call_reject"; from: string; to: string }
  | { kind: "channel_leave"; channelId: string };

const STORAGE_KEY = "klovy:pendingHangup";
/** Max queued hangups (call + channel leave can coexist). */
const MAX_QUEUE = 8;

let queue: PendingHangup[] = [];
/** Bumped on queue/supersede/full-clear so in-flight flush cannot act after replace. */
let generation = 0;

function sameTarget(a: PendingHangup, b: PendingHangup): boolean {
  if (a.kind === "channel_leave" && b.kind === "channel_leave") {
    return a.channelId === b.channelId;
  }
  // One DM hangup per peer pair — latest kind (end/cancel/timeout/reject) wins.
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
    /* private mode */
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
  // Replace same target; keep different kinds/targets (leave A + cancel B).
  queue = queue.filter((h) => !sameTarget(h, hangup));
  queue.push(hangup);
  if (queue.length > MAX_QUEUE) {
    queue = queue.slice(-MAX_QUEUE);
  }
  persist();
}

/** All pending hangups (flush each independently). */
export function peekAllPendingHangups(): PendingHangup[] {
  return queue.slice();
}

export function getPendingHangupGeneration(): number {
  return generation;
}

/// Pop the head hangup. Siblings stay queued. Re-queue if send fails.
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

/**
 * Clear one hangup after successful send (leave others queued).
 * Does NOT bump generation — multi-item flush must continue after first OK.
 */
export function clearMatchingHangup(hangup: PendingHangup) {
  queue = queue.filter((h) => !sameTarget(h, hangup));
  persist();
}
