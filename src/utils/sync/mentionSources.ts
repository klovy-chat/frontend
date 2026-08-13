/** Persistent @mention source ids across Chat ↔ Settings navigation. */

type Listener = () => void;

let sources = new Set<string>();
const listeners = new Set<Listener>();

function notify() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function getMentionSources(): Set<string> {
  return sources;
}

export function addMentionSource(sourceId: string) {
  if (!sourceId || sources.has(sourceId)) return;
  sources = new Set(sources);
  sources.add(sourceId);
  notify();
}

export function clearMentionSource(sourceId: string) {
  if (!sources.has(sourceId)) return;
  sources = new Set(sources);
  sources.delete(sourceId);
  notify();
}

export function clearAllMentionSources() {
  if (sources.size === 0) return;
  sources = new Set();
  notify();
}

export function subscribeMentionSources(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
