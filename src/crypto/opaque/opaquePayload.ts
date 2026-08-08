import {
  arrayBufferToBase64,
  arrayBufferToUtf8Strict,
  base64ToArrayBuffer,
  utf8ToArrayBuffer,
} from "./bufferUtils";

const BASE64_OPAQUE_RE = /^[A-Za-z0-9+/]+={0,2}$/;

/** Opaque base64 envelope for server storage (server validates strict base64). */
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
    return arrayBufferToUtf8Strict(base64ToArrayBuffer(normalized));
  } catch {
    return null;
  }
}

/** Whether `stored` is our transport base64 wrap (strict UTF-8 + roundtrip). */
export function isLikelyBase64Opaque(stored: string): boolean {
  const trimmed = stored.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return false;
  }
  const decoded = decodeOpaqueLayer(trimmed);
  if (!decoded || decoded === trimmed) return false;
  if (decoded.includes("\uFFFD")) return false;
  return base64NormalizedEqual(wrapOpaquePayload(decoded), trimmed);
}

/** Decode a single opaque layer; returns null when input is not our transport wrap. */
export function unwrapOpaquePayloadOnce(stored: string): string | null {
  const trimmed = stored.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return null;
  }
  if (!isLikelyBase64Opaque(trimmed)) return null;
  return decodeOpaqueLayer(trimmed);
}

/**
 * Unwrap server-stored payload for display.
 * Peels nested transport layers (legacy double-wrap).
 */
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
