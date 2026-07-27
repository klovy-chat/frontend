import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  utf8ToArrayBuffer,
  arrayBufferToUtf8,
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

function isE2eJsonEnvelopeInner(inner: string): boolean {
  if (!inner.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(inner) as Record<string, unknown>;
    return (
      (typeof parsed.type === "number" && typeof parsed.body === "string") ||
      (typeof parsed.keyId === "number" && typeof parsed.data === "string")
    );
  } catch {
    return false;
  }
}

/** Whether `stored` looks like a transport base64 wrap (not human plaintext). */
export function isLikelyBase64Opaque(stored: string): boolean {
  const trimmed = stored.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return false;
  }
  if (!BASE64_OPAQUE_RE.test(trimmed)) return false;
  const normalized = normalizeBase64(trimmed);
  if (normalized.length < 4) return false;
  try {
    const decoded = arrayBufferToUtf8(base64ToArrayBuffer(normalized));
    if (!decoded || decoded === trimmed) return false;
    if (isE2eJsonEnvelopeInner(decoded)) return true;
    return decoded.length > 0;
  } catch {
    return false;
  }
}

/** Decode a single opaque layer; returns null when input is not transport base64. */
export function unwrapOpaquePayloadOnce(stored: string): string | null {
  const trimmed = stored.trim();
  if (!trimmed || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return null;
  }
  if (!isLikelyBase64Opaque(trimmed)) return null;
  try {
    return arrayBufferToUtf8(base64ToArrayBuffer(normalizeBase64(trimmed)));
  } catch {
    return null;
  }
}

/**
 * Unwrap server-stored payload for display.
 * Peels nested transport layers (legacy double-wrap) but stops before E2E JSON envelopes.
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
    if (isE2eJsonEnvelopeInner(decoded)) return current;
    if (!isLikelyBase64Opaque(decoded)) return decoded;
    current = decoded;
  }
  return current;
}
