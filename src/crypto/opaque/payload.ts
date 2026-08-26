// payload.ts
// Strict Base64 koperta (serwer waliduje ten sam alfabet).
// Zakres:
//  - unwrap zwraca null gdy to nie nasz wrap
//  - strict Base64 jak waliduje serwer; unwrap → null gdy nie nasz wrap
// Nie loguj treści — tylko metadata błędów.
// Przy zmianach: buffer.ts, encrypt.ts.

import {
  arrayBufferToBase64,
  arrayBufferToUtf8,
  base64ToArrayBuffer,
  isValidUtf8Buffer,
  utf8ToArrayBuffer,
} from "./buffer";

const BASE64_OPAQUE_RE = /^[A-Za-z0-9+/]+={0,2}$/;

export function wrapOpaquePayload(inner: string): string {
  return arrayBufferToBase64(utf8ToArrayBuffer(inner));
}

export function normalizeBase64(input: string): string {
  const trimmed = input.trim().replace(/\s+/g, "");
  if (!trimmed) return trimmed;
  const mod = trimmed.length % 4;
  if (mod === 0) return trimmed;
  return trimmed + "=".repeat(4 - mod);
}

function base64NormalizedEqual(a: string, b: string): boolean {
  return (
    normalizeBase64(a).replace(/=+$/, "") === normalizeBase64(b).replace(/=+$/, "")
  );
}

function decodeOpaqueLayer(stored: string): string | null {
  const normalized = normalizeBase64(stored.trim());
  if (!BASE64_OPAQUE_RE.test(normalized) || normalized.length < 4) {
    return null;
  }
  try {
    const buffer = base64ToArrayBuffer(normalized);
    if (!isValidUtf8Buffer(buffer)) return null;
    return arrayBufferToUtf8(buffer);
  } catch {
    return null;
  }
}

function isLikelyBase64Opaque(stored: string): boolean {
  const trimmed = stored.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return false;
  }
  const decoded = decodeOpaqueLayer(trimmed);
  if (!decoded || decoded === trimmed) return false;
  if (decoded.includes("\uFFFD")) return false;
  return base64NormalizedEqual(wrapOpaquePayload(decoded), trimmed);
}

function unwrapOpaquePayloadOnce(stored: string): string | null {
  const trimmed = stored.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return null;
  }
  if (!isLikelyBase64Opaque(trimmed)) return null;
  return decodeOpaqueLayer(trimmed);
}

export function unwrapOpaquePayload(stored: string): string {
  const trimmed = stored.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }

  let current = trimmed;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!isLikelyBase64Opaque(current)) return current;
    const decoded = unwrapOpaquePayloadOnce(current);
    if (!decoded || decoded === current) return current;
    if (!isLikelyBase64Opaque(decoded)) return decoded;
    current = decoded;
  }
  return current;
}
