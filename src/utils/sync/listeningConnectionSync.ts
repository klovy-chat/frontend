export const LISTENING_CONNECTION_CHANGED = "klovy:listening-connection-changed";

export function notifyListeningConnectionChanged(): void {
  window.dispatchEvent(new Event(LISTENING_CONNECTION_CHANGED));
}
