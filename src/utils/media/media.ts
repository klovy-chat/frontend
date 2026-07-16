import { getBackendBaseUrl } from "../env/backendUrl";
import { usesDirectBackendUrl } from "../env/appEnv";
import { isAttachmentKey, privateAttachmentApiUrl, publicCdnUrl } from "./cdn";
import { isAllowedExternalMediaUrl, isSafeMessageUploadPath } from "./mediaAllowlist";
import { CLIENT_HEADER_NAME, CLIENT_IDENTIFIER } from "../env/clientId";
import i18n from "../../i18n/config";

/**
 * Pobiera zasób medialny. Dla adresów własnego backendu dołącza identyfikator
 * klienta (wymagany przez filtr `client_guard`) i wysyła ciasteczka. Dla
 * zewnętrznych, dozwolonych hostów (CDN/GIF) pomija nagłówek (uniknięcie
 * preflightu blokowanego przez CDN) oraz ciasteczka (higiena).
 */
function fetchMediaResource(url: string): Promise<Response> {
  const isExternal =
    /^https?:\/\//i.test(url) && isAllowedExternalMediaUrl(url);
  if (isExternal) {
    return fetch(url, { credentials: "omit", redirect: "follow" });
  }
  return fetch(url, {
    credentials: "include",
    redirect: "follow",
    headers: { [CLIENT_HEADER_NAME]: CLIENT_IDENTIFIER },
  });
}

function attachmentApiUrl(path: string): string {
  let url = privateAttachmentApiUrl(path);
  if (usesDirectBackendUrl) {
    url = `${getBackendBaseUrl()}${url}`;
  }
  return url;
}

export function resolveMediaUrl(fileUrl: string): string | null {
  const trimmed = fileUrl.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("//")) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return isAllowedExternalMediaUrl(trimmed) ? trimmed : null;
  }

  const path = trimmed.replace(/^\/+/, "");
  if (!isSafeMessageUploadPath(path)) {
    return null;
  }

  if (isAttachmentKey(path)) {
    return publicCdnUrl(path);
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

/**
 * Derive thumbnail storage key from a full attachment WebP key.
 * `…/{uuid}.webp` → `…/{uuid}.thumb.webp`. Returns null for non-webp / already-thumb.
 */
export function attachmentThumbKey(fileUrl: string): string | null {
  const trimmed = fileUrl.trim().replace(/^\/+/, "");
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return null;
  if (!isAttachmentKey(trimmed) || !isSafeMessageUploadPath(trimmed)) return null;
  if (trimmed.endsWith(".thumb.webp")) return null;
  if (!trimmed.endsWith(".webp")) return null;
  return `${trimmed.slice(0, -".webp".length)}.thumb.webp`;
}

/** Prefer thumbnail URL for chat bubbles; falls back to full key when no thumb convention. */
export function resolveChatImagePreviewUrl(fileUrl: string): string {
  return attachmentThumbKey(fileUrl) ?? fileUrl.trim();
}

/** Fallback przez uwierzytelniony proxy backendu, gdyby bezpośredni CDN zawiódł. */
export function legacyAttachmentFallbackUrl(fileUrl: string): string | null {
  const trimmed = fileUrl.trim();
  if (!trimmed || /^https?:\/\//i.test(trimmed)) return null;
  const path = trimmed.replace(/^\/+/, "");
  if (!isSafeMessageUploadPath(path) || !isAttachmentKey(path)) return null;
  return attachmentApiUrl(path);
}

function isLocalUpload(fileUrl: string): boolean {
  return !/^https?:\/\//i.test(fileUrl.trim());
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}

export async function downloadMediaFile(
  fileUrl: string,
  fileName: string,
): Promise<void> {
  const displayName = fileName.trim() || i18n.t("common.download");

  if (isLocalUpload(fileUrl)) {
    const path = fileUrl.replace(/^\/+/, "");
    if (!isSafeMessageUploadPath(path)) {
      throw new Error(i18n.t("media.invalidUrl"));
    }
    const params = new URLSearchParams({ path, name: displayName });
    let downloadUrl = `/api/messages/download-file?${params}`;

    if (usesDirectBackendUrl) {
      downloadUrl = `${getBackendBaseUrl()}${downloadUrl}`;
    }

    const response = await fetchMediaResource(downloadUrl);
    if (!response.ok) {
      throw new Error(i18n.t("media.downloadFailed"));
    }

    triggerBlobDownload(await response.blob(), displayName);
    return;
  }

  const resolvedUrl = resolveMediaUrl(fileUrl);
  if (!resolvedUrl) {
    throw new Error(i18n.t("media.invalidUrl"));
  }

  try {
    const response = await fetchMediaResource(resolvedUrl);
    if (!response.ok) {
      throw new Error(i18n.t("media.downloadFailed"));
    }
    triggerBlobDownload(await response.blob(), displayName);
  } catch {
    const anchor = document.createElement("a");
    anchor.href = resolvedUrl;
    anchor.download = displayName;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
}
