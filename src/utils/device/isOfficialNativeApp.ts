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

function hasNativeAppDomMarker(): boolean {
  return document.documentElement?.dataset?.klovyNative === "1";
}

/** Oficjalny klient natywny (Tauri) — nie zwykła przeglądarka mobilna. */
export function isOfficialNativeApp(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  // Android/iOS: token UA ustawiany wyłącznie w tauri.android/ios.conf.json.
  // Mobile shell nie używa remote IPC — wykrywamy po UA / markerze z index.html.
  if (hasNativeAppUserAgentToken() || hasNativeAppDomMarker()) return true;

  // Desktop Tauri (bez custom UA).
  return hasTauriRuntime();
}
