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

export function isAllowedExternalMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!/^https:\/\//i.test(trimmed)) {
    return false;
  }
  if (trimmed.includes("..") || trimmed.includes("\\") || trimmed.includes("@")) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) return false;
    if (hostAllowed(parsed.hostname)) return true;
    // Lazy import pattern avoided — keep logic inline via dynamic import alternative
    return isAllowedExternalMediaLink(trimmed);
  } catch {
    return false;
  }
}

function isAllowedExternalMediaLink(url: string): boolean {
  // Avoid circular import at module init — duplicate minimal path check here.
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const pathAndQuery = `${parsed.pathname}${parsed.search}`;
    if (/\.(gif|jpe?g|png|webp)(?:[?#]|$)/i.test(pathAndQuery)) {
      return true;
    }
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const trusted =
      host === "cdn.discordapp.com" ||
      host === "media.discordapp.net" ||
      host === "i.imgur.com" ||
      host === "media.tenor.com" ||
      host === "images.unsplash.com" ||
      host === "raw.githubusercontent.com";
    return trusted && parsed.pathname.split("/").filter(Boolean).length > 0;
  } catch {
    return false;
  }
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
