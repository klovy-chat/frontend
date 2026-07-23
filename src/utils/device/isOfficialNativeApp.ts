declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

function hasTauriRuntime(): boolean {
  return window.__TAURI__ != null || window.__TAURI_INTERNALS__ != null;
}

/** Oficjalny klient desktopowy Tauri (Windows / Linux / macOS). */
export function isOfficialNativeApp(): boolean {
  if (typeof window === "undefined") return false;
  return hasTauriRuntime();
}
