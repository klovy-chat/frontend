// isDesktop.ts
// Czy to oficjalny Tauri (nie zwykła przeglądarka).
// Zakres:
//  - badge IPC, update notice, ominięcie mobile gate
//  - oficjalny Tauri: badge, update, ominięcie mobile gate
// Detekcja musi zostać wąska — fałszywy positive otworzy web na telefonie.
// Przy zmianach: isMobile.ts, appBadge.ts, DesktopOnly.tsx.

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: {
      invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
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
