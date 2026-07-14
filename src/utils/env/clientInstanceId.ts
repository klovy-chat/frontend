const STORAGE_KEY = "klovy.spotify.clientInstanceId";

export function getClientInstanceId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.length <= 128) return existing;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    return `web-${Date.now()}`;
  }
}
