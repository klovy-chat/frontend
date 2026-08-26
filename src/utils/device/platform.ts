// platform.ts
// Surowy token platformy z nawiasu User-Agent (bez mapy marketingowej).
// Zakres:
//  - odrzuca X11/WOW64/compatible/rv:
//  - surowy token z nawiasu UA (nie etykieta marketingowa)
// Do X-Klovy-User-Agent, nie do etykiety OS w UI (to osLabel).
// Przy zmianach: clientInfo.ts, osLabel.ts.

const PLATFORM_SEGMENT_NOISE = new Set([
  "X11",
  "WOW64",
  "Win64",
  "U",
  "Mobile",
  "Tablet",
  "compatible",
]);

export function parseUserAgentPlatform(userAgent: string): string | null {
  const match = userAgent.match(/\(([^)]+)\)/);
  if (!match?.[1]) return null;

  const segment = match[1]
    .split(";")
    .map((part) => part.trim())
    .find((part) => {
      if (!part) return false;
      if (PLATFORM_SEGMENT_NOISE.has(part)) return false;
      if (/^rv:/i.test(part)) return false;
      if (/^compatible$/i.test(part)) return false;
      return true;
    });

  return segment ?? null;
}
