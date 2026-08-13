/** Active chat key (`dm:id` / `channel:id`) so shell bridges respect "viewing". */

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
  return activeKey === `${kind}:${id}`;
}

export function subscribeActiveConversation(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
