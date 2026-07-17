function configuredCdnHost(): string | null {
  const raw = import.meta.env.VITE_CDN_BASE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  const envCdn = configuredCdnHost();
  return (
    host === "media.giphy.com" ||
    host === "i.giphy.com" ||
    host.endsWith(".giphy.com") ||
    host === "cdn.klovy.chat" ||
    (envCdn != null && host === envCdn)
  );
}

function listeningHostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return (
    host === "open.spotify.com" ||
    host === "spotify.com" ||
    host.endsWith(".spotify.com") ||
    host === "i.scdn.co" ||
    host === "mosaic.scdn.co" ||
    host.endsWith(".scdn.co")
  );
}

export function isAllowedListeningUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    return false;
  }
  if (trimmed.includes("..") || trimmed.includes("\\") || trimmed.includes("@")) {
    return false;
  }
  try {
    return listeningHostAllowed(new URL(trimmed).hostname);
  } catch {
    return false;
  }
}

export function isAllowedExternalMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    return false;
  }
  if (trimmed.includes("..") || trimmed.includes("\\")) {
    return false;
  }
  try {
    return hostAllowed(new URL(trimmed).hostname);
  } catch {
    return false;
  }
}

function normalizeRelativePath(path: string): string | null {
  const normalized = path.trim().replace(/^\/+/, "").replace(/\\/g, "/");
  if (!normalized || normalized.includes("..")) {
    return null;
  }
  return normalized;
}

export function isSafeMessageUploadPath(path: string): boolean {
  const normalized = normalizeRelativePath(path);
  if (!normalized) {
    return false;
  }
  return normalized.startsWith("attachments/") || normalized.startsWith("assets/");
}

export function isSafeProfileUploadPath(path: string): boolean {
  const normalized = normalizeRelativePath(path);
  if (!normalized) {
    return false;
  }
  return (
    normalized.startsWith("avatars/") ||
    normalized.startsWith("banners/") ||
    normalized.startsWith("assets/")
  );
}

export function isAllowedGifMediaUrl(url: string): boolean {
  return isAllowedExternalMediaUrl(url);
}

export function isSafeOtpauthUrl(url: string): boolean {
  const trimmed = url.trim();
  return trimmed.toLowerCase().startsWith("otpauth://") && !trimmed.includes(" ");
}
