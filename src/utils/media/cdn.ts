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

export function privateAttachmentApiUrl(key: string): string {
  const normalized = key.trim().replace(/^\/+/, "");
  const params = new URLSearchParams({ path: normalized });
  return `/api/messages/attachment?${params.toString()}`;
}
