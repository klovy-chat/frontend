// payload.ts
// Koperta treści na transport: prefiks k1. + Base64.
// Zakres:
//  - UI odwijają tylko k1. — nigdy zgadywanie Base64 na zwykłym tekście
//  - wrap wychodzących wiadomości
// Zdanie, słowo, JSON — zostają jak z API, dopóki nie ma prefiksu.
// Przy zmianach: encrypt.ts, utils/messages/storage.rs.

import {
  arrayBufferToBase64,
  arrayBufferToUtf8,
  base64ToArrayBuffer,
  isValidUtf8Buffer,
  utf8ToArrayBuffer,
} from "./buffer";

const OPAQUE_PREFIX = "k1.";
const BASE64_OPAQUE_RE = /^[A-Za-z0-9+/]+={0,2}$/;

function encodeOpaqueBody(inner: string): string {
  return arrayBufferToBase64(utf8ToArrayBuffer(inner));
}

export function wrapOpaquePayload(inner: string): string {
  return OPAQUE_PREFIX + encodeOpaqueBody(inner);
}

function isStandardBase64(stored: string): boolean {
  return (
    stored.length >= 4 &&
    stored.length % 4 === 0 &&
    BASE64_OPAQUE_RE.test(stored)
  );
}

function decodeOpaqueBody(body: string): string | null {
  if (!isStandardBase64(body)) return null;
  try {
    const buffer = base64ToArrayBuffer(body);
    if (!isValidUtf8Buffer(buffer)) return null;
    const text = arrayBufferToUtf8(buffer);
    if (!text || text.includes("\uFFFD")) return null;
    if (encodeOpaqueBody(text) !== body) return null;
    return text;
  } catch {
    return null;
  }
}

export function unwrapOpaquePayload(stored: string): string {
  const trimmed = stored.trim();
  if (!trimmed.startsWith(OPAQUE_PREFIX)) {
    return stored;
  }

  let current = trimmed;
  for (let depth = 0; depth < 4; depth += 1) {
    if (!current.startsWith(OPAQUE_PREFIX)) return current;
    const decoded = decodeOpaqueBody(current.slice(OPAQUE_PREFIX.length));
    if (!decoded || decoded === current) return current;
    current = decoded;
  }
  return current;
}
