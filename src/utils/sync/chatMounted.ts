// chatMounted.ts
// Czy route Chat jest zamontowany.
// Zakres:
//  - false → UnreadSync trzyma title, Sidebar nie ma rosteru
//  - czy route Chat żyje — UnreadSync vs Sidebar
// markChatMounted w Chat.tsx w useEffect cleanup.
// Przy zmianach: pages/Chat.tsx, UnreadSync.tsx.

let mounted = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) {
    try {
      l();
    } catch {
      /* ignore */
    }
  }
}

export function markChatMounted(): () => void {
  mounted += 1;
  notify();
  return () => {
    mounted = Math.max(0, mounted - 1);
    notify();
  };
}

export function isChatMounted(): boolean {
  return mounted > 0;
}

export function subscribeChatMounted(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
