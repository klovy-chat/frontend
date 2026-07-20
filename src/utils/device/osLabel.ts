const ARCH_TOKENS = new Set([
  "x86",
  "x86_64",
  "x64",
  "amd64",
  "i686",
  "arm64",
  "aarch64",
  "wow64",
  "64-bit",
  "32-bit",
]);

function isVersionToken(token: string): boolean {
  if (!token) return true;
  if (/^[\d._]+$/.test(token)) return true;
  if (/^[\d.]+(?:\.\d+)*$/.test(token)) return true;
  return false;
}

/** Usuwa numery wersji i tokeny architektury — bez mapowania nazw systemów. */
export function simplifyOsLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  const primary = trimmed.split("·")[0]?.trim() ?? trimmed;
  const words: string[] = [];
  let skipNext = false;

  for (const word of primary.split(/\s+/)) {
    if (!word) continue;
    if (skipNext) {
      skipNext = false;
      continue;
    }
    if (word.toLowerCase() === "nt") {
      skipNext = true;
      continue;
    }
    if (ARCH_TOKENS.has(word.toLowerCase()) || isVersionToken(word)) continue;
    words.push(word);
  }

  return words.join(" ").trim();
}

export function primaryOsSegment(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return trimmed.split("·")[0]?.trim() ?? trimmed;
}
