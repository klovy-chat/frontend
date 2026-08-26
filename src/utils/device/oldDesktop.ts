// oldDesktop.ts
// Stary desktop bez unread IPC + snooze notice 3 dni.
// Zakres:
//  - localStorage until
//  - cutoff wersji + snooze 3 dni w localStorage
// Nowy cutoff wersji: warunek tutaj, nie w CSS.
// Przy zmianach: UpdateNotice.tsx, isDesktop.ts.

import { isDesktop } from "./isDesktop";

const DOWNLOAD_URL =
  "https://github.com/Klovy-Systems/klovy-chat-application/releases/latest";

const SNOOZE_KEY = "klovy_legacy_desktop_notice_until";
const SNOOZE_MS = 3 * 24 * 60 * 60 * 1000;

export function desktopDownloadUrl(): string {
  return DOWNLOAD_URL;
}

export function isLegacyDesktopNoticeSnoozed(): boolean {
  try {
    const raw = localStorage.getItem(SNOOZE_KEY);
    if (!raw) return false;
    const until = Number.parseInt(raw, 10);
    return Number.isFinite(until) && until > Date.now();
  } catch {
    return false;
  }
}

export function snoozeLegacyDesktopNotice(): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
  } catch {
    /* ignore */
  }
}

export async function needsLegacyDesktopDownload(): Promise<boolean> {
  if (!isDesktop()) return false;
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke !== "function") return true;
  try {
    await invoke("set_unread_badge", { count: 0 });
    return false;
  } catch {
    return true;
  }
}
