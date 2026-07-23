/** Token w user-agent ustawiany tylko przez oficjalną apkę Tauri (Android/iOS). */
export const OFFICIAL_NATIVE_APP_UA_TOKEN = "KlovyChatNative/";

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

function hasTauriRuntime(): boolean {
  return window.__TAURI__ != null || window.__TAURI_INTERNALS__ != null;
}

function hasNativeAppUserAgentToken(): boolean {
  return navigator.userAgent.includes(OFFICIAL_NATIVE_APP_UA_TOKEN);
}

/** Oficjalny klient natywny (Tauri) — nie zwykła przeglądarka mobilna. */
export function isOfficialNativeApp(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // Android/iOS: token UA ustawiany wyłącznie w tauri.android/ios.conf.json.
  // Nie polegamy na __TAURI__ — na zdalnym URL Tauri czasem nie wstrzykuje runtime
  // (błędy „Cannot redefine property: postMessage” w logcat).
  if (hasNativeAppUserAgentToken()) return true;

  // Desktop Tauri (bez custom UA).
  return hasTauriRuntime();
}
