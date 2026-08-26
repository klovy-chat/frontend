// unicode.ts
// Sanityzacja Unicode (Zalgo, bidi, zero-width) jak na serwerze.
// Zakres:
//  - pola profilu i podgląd
//  - ten sam limit combining / bidi co validators/unicode.rs
// Zmiana reguł: skopiuj z validators/unicode.rs, nie zgaduj.
// Przy zmianach: ProfileFields.tsx, utils/validators/unicode.rs.

export const MAX_MESSAGE_COMBINING = 12;

const COMBINING_RANGES: [number, number][] = [
  [0x0300, 0x036f],
  [0x0483, 0x0489],
  [0x0591, 0x05bd],
  [0x0610, 0x061a],
  [0x064b, 0x065f],
  [0x06d6, 0x06ed],
  [0x0730, 0x074a],
  [0x07eb, 0x07f3],
  [0x08d3, 0x08e1],
  [0x08e3, 0x08ff],
  [0x0c00, 0x0c0c],
  [0x0c3e, 0x0c4d],
  [0x1ab0, 0x1aff],
  [0x1dc0, 0x1dff],
  [0x20d0, 0x20ff],
  [0xfe00, 0xfe0f],
  [0xfe20, 0xfe2f],
];

function isCombiningMark(code: number): boolean {
  return COMBINING_RANGES.some(([start, end]) => code >= start && code <= end);
}

function isDisallowedCode(code: number): boolean {
  if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
    return code !== 0x9 && code !== 0xa && code !== 0xd;
  }
  return (
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2069) ||
    code === 0xfeff ||
    (code >= 0xfff9 && code <= 0xfffb)
  );
}

export function sanitizeUnicodeText(
  input: string,
  maxChars: number,
  maxCombining = 0,
): string {
  let combining = 0;
  let out = "";

  for (const char of input) {
    const code = char.codePointAt(0)!;
    if (isDisallowedCode(code)) continue;

    if (isCombiningMark(code)) {
      if (combining >= maxCombining) continue;
      combining += 1;
    }

    out += char;
    if ([...out].length >= maxChars) break;
  }

  return out;
}

export function sanitizeDisplayNameInput(input: string): string {
  return sanitizeUnicodeText(input, 32, 0);
}

export function sanitizeMessageInput(input: string, maxChars = 2000): string {
  return sanitizeUnicodeText(input, maxChars, MAX_MESSAGE_COMBINING);
}

export function sanitizeBioInput(input: string): string {
  return sanitizeUnicodeText(input, 500, 8);
}
