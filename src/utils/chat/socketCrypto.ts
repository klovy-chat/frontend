// socketCrypto.ts
// Szyfrowanie ramek po stronie klienta (klucz z /ws-crypto).
// Zakres:
//  - fail zamknięty w prod
//  - szyfrowanie ramek kluczem z /ws-crypto
// Zmiana algorytmu: ws/encrypt.rs + ten plik razem.
// Przy zmianach: api/ws.ts, ws/encrypt.rs, ws/keys.rs.

const FRAME_VERSION = 1;
const NONCE_LEN = 12;

function hexToBytes(hex: string): Uint8Array {
  if (hex.length !== 64) {
    throw new Error("Invalid WS crypto key");
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function importAesKey(keyHex: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(hexToBytes(keyHex)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface WsCryptoSession {
  token: string;
  keyHex: string;
}

export class WsFrameCrypto {
  private readonly key: CryptoKey;

  private constructor(key: CryptoKey) {
    this.key = key;
  }

  static async create(session: WsCryptoSession): Promise<WsFrameCrypto> {
    const key = await importAesKey(session.keyHex);
    return new WsFrameCrypto(key);
  }

  async encrypt(plaintext: string): Promise<ArrayBuffer> {
    const iv = crypto.getRandomValues(new Uint8Array(NONCE_LEN));
    const encoded = new TextEncoder().encode(plaintext);
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      this.key,
      encoded,
    );
    const out = new Uint8Array(1 + NONCE_LEN + ciphertext.byteLength);
    out[0] = FRAME_VERSION;
    out.set(iv, 1);
    out.set(new Uint8Array(ciphertext), 1 + NONCE_LEN);
    return out.buffer;
  }

  async decrypt(data: ArrayBuffer): Promise<string> {
    const bytes = new Uint8Array(data);
    if (bytes.length <= 1 + NONCE_LEN || bytes[0] !== FRAME_VERSION) {
      throw new Error("Invalid encrypted WS frame");
    }
    const iv = bytes.slice(1, 1 + NONCE_LEN);
    const ciphertext = bytes.slice(1 + NONCE_LEN);
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      this.key,
      toArrayBuffer(ciphertext),
    );
    return new TextDecoder().decode(plain);
  }
}

export const WS_CRYPTO_QUERY_PARAM = "wsk";
