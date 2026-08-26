// backend.ts
// Składanie bazowego URL API z VITE_BACKEND_URL.
// Zakres:
//  - normalize (bez trailing slash)
//  - składanie VITE_BACKEND_URL bez trailing slash
// Vite proxy i klient HTTP muszą dostać ten sam origin.
// Przy zmianach: vite.config.ts, api/client.ts, api/ws.ts.

const DEFAULT_BACKEND_URL = "http://127.0.0.1:6700";

function isLoopbackHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

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
