// livekit.ts
// Allowlista hostów LiveKit z env.
// Zakres:
//  - odrzuca zły URL roomu zanim connect
//  - hosty z env; zły URL roomu odrzuć przed connect
// Nowy deployment LiveKit: VITE_ + backend LIVEKIT_URL.
// Przy zmianach: CallContext.tsx, utils/config.rs.

function getAllowedHosts(): string[] {
  const raw = import.meta.env.VITE_LIVEKIT_ALLOWED_HOSTS;
  const configured = (raw ?? "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
  return configured.length > 0 ? configured : ["*.livekit.cloud"];
}

function hostMatches(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1);
    return host.endsWith(suffix) && host.length > suffix.length;
  }
  return host === pattern;
}

function isPrivateHost(host: string): boolean {
  return (
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    host.startsWith("169.254.") ||
    host.endsWith(".local")
  );
}

export function isAllowedLiveKitUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "wss:" && parsed.protocol !== "https:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();

    if (isPrivateHost(host)) {
      return import.meta.env.DEV;
    }

    if (import.meta.env.DEV) return true;

    return getAllowedHosts().some((pattern) => hostMatches(host, pattern));
  } catch {
    return false;
  }
}
