let receivedCount = 0;
const listeners = new Set<() => void>();

export function getReceivedFriendRequestCount() {
  return receivedCount;
}

export function subscribeReceivedFriendRequestCount(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setReceivedFriendRequestCount(count: number) {
  const next = Math.max(0, Math.floor(count));
  if (next === receivedCount) return;
  receivedCount = next;
  listeners.forEach((listener) => listener());
}

export function resetReceivedFriendRequestCount() {
  setReceivedFriendRequestCount(0);
}
