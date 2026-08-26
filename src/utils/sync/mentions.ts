// mentions.ts
// Ids źródeł @wzmianek między nawigacją.
// Zakres:
//  - persist, żeby composer nie resetował listy
//  - persist ids @źródeł, żeby composer nie resetował listy
// Nowe źródło (np. wszyscy z kanału): schema tutaj + Mentions.tsx.
// Przy zmianach: Mentions.tsx, MessageInput.tsx.

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
