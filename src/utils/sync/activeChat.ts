// activeChat.ts
// Klucz oglądanej rozmowy (dm:id / channel:id).
// Zakres:
//  - viewing-zero listy i title
//  - dm:id / channel:id aktualnie oglądanej rozmowy
// Nulluj przy wyjściu z czatu, inaczej mute/unread się pomylą.
// Przy zmianach: Chat.tsx, Sidebar.tsx, UnreadSync.tsx.

type Listener = () => void;

let activeKey: string | null = null;
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

export function setActiveConversationKey(key: string | null) {
  if (activeKey === key) return;
  activeKey = key;
  notify();
}

export function getActiveConversationKey(): string | null {
  return activeKey;
}

export function isViewingConversation(kind: "dm" | "channel", id: string): boolean {
  return getActiveConversationKey() === `${kind}:${id}`;
}

export function subscribeActiveConversation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
