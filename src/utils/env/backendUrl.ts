const DEFAULT_BACKEND_URL = "http://127.0.0.1:6700";

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

/**
 * Normalizuje adres backendu do stabilnej postaci na Windows, Linux i macOS.
 * Lokalne adresy pętli zwrotnej mapuje na 127.0.0.1,
 * żeby proxy i fetch nie trafiały przypadkiem w IPv6, gdy serwer słucha na IPv4.
 * Zdalne hosty (Docker, produkcja) pozostają bez zmian.
 */
export function normalizeBackendUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return DEFAULT_BACKEND_URL;

  try {
    const parsed = new URL(trimmed);

    if (isLoopbackHost(parsed.hostname)) {
      parsed.hostname = "127.0.0.1";
    }

    return parsed.toString().replace(/\/$/, "");
  } catch {
    return trimmed.replace(/\/$/, "");
  }
}

export function getBackendBaseUrl(): string {
  const configured = import.meta.env.VITE_BACKEND_URL;
  return normalizeBackendUrl(configured || DEFAULT_BACKEND_URL);
}
