/** Whether ChatPage is mounted — Sidebar owns title badge while true. */

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

export function markChatPageMounted(): () => void {
  mounted += 1;
  notify();
  return () => {
    mounted = Math.max(0, mounted - 1);
    notify();
  };
}

export function isChatPageMounted(): boolean {
  return mounted > 0;
}

export function subscribeChatPageMounted(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
