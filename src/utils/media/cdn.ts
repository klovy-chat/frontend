// cdn.ts
// Składanie publicznego URL R2/CDN.
// Zakres:
//  - baza z env + klucz obiektu
//  - publiczny URL R2 z env + klucz obiektu
// Klucze obiektów: storage/keys.rs — nie zgaduj path.
// Przy zmianach: cdnVersion.ts, utils/storage/keys.rs.

const CDN_BASE =
  import.meta.env.VITE_CDN_BASE_URL?.replace(/\/+$/, "") ??
  "https://cdn.klovy.chat";

export function publicCdnUrl(key: string, version?: string | number): string {
  const normalized = key.trim().replace(/^\/+/, "");
  const base = `${CDN_BASE}/${normalized}`;
  return version != null ? `${base}?v=${encodeURIComponent(String(version))}` : base;
}

export function normalizeMediaKey(path: string): string {
  return path.trim().replace(/^\/+/, "").replace(/\\/g, "/");
}

export function isBannerKey(path: string): boolean {
  return normalizeMediaKey(path).startsWith("banners/");
}

export function isAvatarKey(path: string): boolean {
  return normalizeMediaKey(path).startsWith("avatars/");
}

export function isAttachmentKey(path: string): boolean {
  const normalized = path.trim().replace(/^\/+/, "");
  return (
    normalized.startsWith("attachments/dm/") ||
    normalized.startsWith("attachments/groups/")
  );
}
