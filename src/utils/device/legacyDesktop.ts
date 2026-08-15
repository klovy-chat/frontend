import { isOfficialNativeApp } from "./isOfficialNativeApp";

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

/** Old official desktop (no unread-badge IPC) cannot auto-update. */
export async function needsLegacyDesktopDownload(): Promise<boolean> {
  if (!isOfficialNativeApp()) return false;
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke !== "function") return true;
  try {
    await invoke("set_unread_badge", { count: 0 });
    return false;
  } catch {
    return true;
  }
}
