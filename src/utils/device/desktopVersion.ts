import { isDesktop } from "./isDesktop";

export const DESKTOP_DOWNLOAD_URL =
  "https://github.com/klovy-chat/application/releases/latest";

export async function applyDesktopVersionHeaders(headers: Headers): Promise<void> {
  if (!isDesktop()) return;

  headers.set("X-Klovy-Desktop", "1");
  const invoke = window.__TAURI_INTERNALS__?.invoke;
  if (typeof invoke !== "function") return;

  try {
    const version = await invoke("desktop_version");
    if (typeof version === "string") {
      headers.set("X-Klovy-Desktop-Version", version);
    }
  } catch {
    // Older desktop builds do not expose this command and are rejected by the backend.
  }
}
