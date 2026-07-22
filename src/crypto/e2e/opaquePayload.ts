import { arrayBufferToBase64, base64ToArrayBuffer, utf8ToArrayBuffer, arrayBufferToUtf8 } from "./bufferUtils";

/** Opaque base64 envelope for server storage (server validates strict base64). */
export function wrapOpaquePayload(inner: string): string {
  return arrayBufferToBase64(utf8ToArrayBuffer(inner));
}

/** Unwrap server-stored payload; supports legacy unwrapped JSON for old messages. */
export function unwrapOpaquePayload(stored: string): string {
  const trimmed = stored.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return trimmed;
  }
  try {
    return arrayBufferToUtf8(base64ToArrayBuffer(trimmed));
  } catch {
    return trimmed;
  }
}
