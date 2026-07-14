/**
 * Walidacja adresu serwera LiveKit zwracanego przez backend.
 *
 * Zasada deny-by-default w produkcji: dozwolone są wyłącznie hosty z allowlisty
 * (env `VITE_LIVEKIT_ALLOWED_HOSTS`, domyślnie `*.livekit.cloud`). Chroni to
 * przed przekierowaniem połączeń audio/wideo na serwer atakującego, gdyby
 * odpowiedź `/api/voice/token` została zmanipulowana.
 */

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
    const suffix = pattern.slice(1); // ".livekit.cloud"
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

    // Adresy lokalne/prywatne tylko w trybie deweloperskim.
    if (isPrivateHost(host)) {
      return import.meta.env.DEV;
    }

    // W dev pozwalamy na dowolny publiczny host (łatwiejsze testy).
    if (import.meta.env.DEV) return true;

    // W produkcji: wyłącznie hosty z allowlisty.
    return getAllowedHosts().some((pattern) => hostMatches(host, pattern));
  } catch {
    return false;
  }
}
