import { isOfficialNativeApp } from "./isOfficialNativeApp";

/** Push the web unread total onto the desktop Dock / taskbar badge. */
export function setNativeUnreadBadge(count: number): void {
  if (!isOfficialNativeApp()) return;
  const n = Math.max(0, Math.floor(count || 0));
  try {
    const invoke = window.__TAURI_INTERNALS__?.invoke;
    if (typeof invoke !== "function") return;
    void invoke("set_unread_badge", { count: n }).catch(() => {
      /* older desktop builds without the command */
    });
  } catch {
    /* browser / missing IPC */
  }
}
