// isDesktop.ts
// Czy to oficjalny Tauri (nie zwykła przeglądarka).
// Zakres:
//  - ominięcie mobile gate dla oficjalnego Tauri
// Detekcja musi zostać wąska — fałszywy positive otworzy web na telefonie.
// Przy zmianach: desktopVersion.ts.

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: {
      invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
    Capacitor?: {
      isNativePlatform?: () => boolean;
    };
  }
}

function hasTauriRuntime(): boolean {
  return window.__TAURI__ != null || window.__TAURI_INTERNALS__ != null;
}

export function isDesktop(): boolean {
  if (typeof window === "undefined") return false;
  return hasTauriRuntime();
}

export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  return window.Capacitor?.isNativePlatform?.() === true;
}
