export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const normalized = base64.trim().replace(/\s+/g, "");
  const mod = normalized.length % 4;
  const padded =
    mod === 0 ? normalized : normalized + "=".repeat(4 - mod);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export function utf8ToArrayBuffer(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

export function arrayBufferToUtf8(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}
