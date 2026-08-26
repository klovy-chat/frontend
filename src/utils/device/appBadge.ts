// appBadge.ts
// Liczba na ikonie apki (Tauri IPC / Badging API).
// Zakres:
//  - setAppBadge(count) z unread
//  - Badging API / Tauri IPC z sumy unread
// Stary desktop tego nie umie — UpdateNotice, nie crash.
// Przy zmianach: unread.ts, App.tsx, isDesktop.ts.

import { isDesktop } from "./isDesktop";

export function setAppBadge(count: number): void {
  if (!isDesktop()) return;
  const n = Math.max(0, Math.floor(count || 0));
  try {
    const invoke = window.__TAURI_INTERNALS__?.invoke;
    if (typeof invoke !== "function") return;
    void invoke("set_unread_badge", { count: n }).catch(() => {

    });
  } catch {

  }
}
