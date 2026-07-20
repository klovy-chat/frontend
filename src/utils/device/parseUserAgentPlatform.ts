const PLATFORM_SEGMENT_NOISE = new Set([
  "X11",
  "WOW64",
  "Win64",
  "U",
  "Mobile",
  "Tablet",
  "compatible",
]);

/** Pierwszy segment platformy z nawiasu user-agenta — bez mapowania na nazwy OS. */
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
