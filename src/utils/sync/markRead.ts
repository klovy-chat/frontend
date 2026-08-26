// markRead.ts
// Kolejka mark-read: pending + in-flight, persist na unload.
// Zakres:
//  - pendingZero = heal ma trzymać 0 aż absolute z serwera
//  - pending + in-flight; persist na unload; pendingZero do healu
// generation przy logout, żeby stary send nie wrócił po clear.
// Przy zmianach: ChatWindow.tsx, UnreadSync.tsx, ws mark-read.

type PendingMark =
  | { kind: "dm"; userId: string; contactId: string }
  | { kind: "channel"; userId: string; channelId: string };

type Listener = () => void;

const STORAGE_KEY = "klovy:pendingMarkRead";

const pending: PendingMark[] = [];

const inFlight = new Map<string, PendingMark>();

let generation = 0;
const listeners = new Set<Listener>();

function markKey(mark: PendingMark): string {
  return mark.kind === "dm"
    ? `dm:${mark.contactId}`
    : `channel:${mark.channelId}`;
}

function notifyPendingChanged() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

function persistPending(notify = true) {
  try {
    const payload = {
      pending,
      inFlight: [...inFlight.values()],
    };
    if (payload.pending.length === 0 && payload.inFlight.length === 0) {
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    }
  } catch {

  } finally {
    if (notify) notifyPendingChanged();
  }
}

function pushMarkIfValid(item: unknown, into: PendingMark[]) {
  if (!item || typeof item !== "object") return;
  const mark = item as PendingMark;
  if (mark.kind === "dm" && mark.userId && mark.contactId) {
    into.push({ kind: "dm", userId: mark.userId, contactId: mark.contactId });
  } else if (mark.kind === "channel" && mark.userId && mark.channelId) {
    into.push({
      kind: "channel",
      userId: mark.userId,
      channelId: mark.channelId,
    });
  }
}

function loadPersistedPending() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;

    if (Array.isArray(parsed)) {
      for (const item of parsed) pushMarkIfValid(item, pending);
      return;
    }
    if (!parsed || typeof parsed !== "object") return;
    const obj = parsed as { pending?: unknown; inFlight?: unknown };
    if (Array.isArray(obj.pending)) {
      for (const item of obj.pending) pushMarkIfValid(item, pending);
    }
    if (Array.isArray(obj.inFlight)) {
      for (const item of obj.inFlight) {
        const tmp: PendingMark[] = [];
        pushMarkIfValid(item, tmp);
        for (const m of tmp) inFlight.set(markKey(m), m);
      }
    }
  } catch {

  }
}

loadPersistedPending();

export function getPendingMarkReadGeneration(): number {
  return generation;
}

export function queuePendingMarkRead(mark: PendingMark, expectedGeneration?: number) {
  if (expectedGeneration !== undefined && expectedGeneration !== generation) {
    return;
  }
  const key = markKey(mark);
  inFlight.delete(key);
  const idx = pending.findIndex((p) => markKey(p) === key);
  if (idx >= 0) pending.splice(idx, 1);
  pending.push(mark);
  persistPending();
}

export function queuePendingMarkReadSync(mark: PendingMark) {
  queuePendingMarkRead(mark);
}

export type TakePendingOpts = {

  redrainInFlight?: boolean;
};

export function takePendingMarkReads(
  forUserId?: string,
  opts?: TakePendingOpts,
): {
  marks: PendingMark[];
  generation: number;
} {
  const g = generation;
  const kept: PendingMark[] = [];
  const marks: PendingMark[] = [];
  for (const m of pending) {
    if (forUserId && m.userId !== forUserId) kept.push(m);
    else marks.push(m);
  }
  pending.length = 0;
  pending.push(...kept);
  if (opts?.redrainInFlight) {
    for (const [key, m] of [...inFlight.entries()]) {
      if (forUserId && m.userId !== forUserId) continue;
      inFlight.delete(key);
      if (!marks.some((x) => markKey(x) === key)) marks.push(m);
    }
  }
  for (const m of marks) {
    inFlight.set(markKey(m), m);
  }

  persistPending(false);
  return { marks, generation: g };
}

export function ackPendingMarkReadByKey(key: string) {
  const hadInFlight = inFlight.delete(key);
  const idx = pending.findIndex((p) => markKey(p) === key);
  if (idx >= 0) {
    pending.splice(idx, 1);
    persistPending(false);
  } else if (!hadInFlight) {
    return;
  } else {
    persistPending(false);
  }
  notifyPendingChanged();
}

export function trackMarkReadInFlight(mark: PendingMark) {
  inFlight.set(markKey(mark), mark);
  persistPending();
}

export function clearPendingMarkReads(): void {
  pending.length = 0;
  inFlight.clear();
  generation += 1;
  persistPending();
}

export function hasPendingMarkReads(forUserId?: string): boolean {
  if (!forUserId) return pending.length > 0 || inFlight.size > 0;
  if (pending.some((m) => m.userId === forUserId)) return true;
  for (const m of inFlight.values()) {
    if (m.userId === forUserId) return true;
  }
  return false;
}

export function peekPendingMarkReadKeys(forUserId?: string): string[] {
  const keys = new Set<string>();
  for (const m of pending) {
    if (forUserId && m.userId !== forUserId) continue;
    keys.add(markKey(m));
  }
  for (const m of inFlight.values()) {
    if (forUserId && m.userId !== forUserId) continue;
    keys.add(markKey(m));
  }
  return [...keys];
}

export function subscribePendingMarkReads(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
