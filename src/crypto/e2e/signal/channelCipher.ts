import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  utf8ToArrayBuffer,
} from "../bufferUtils";
import { unwrapOpaquePayloadOnce, wrapOpaquePayload } from "../opaquePayload";
import { E2E_VERSION_CHANNEL } from "../types";
import {
  clearChannelSenderKeys,
  loadChannelSenderKey,
  saveChannelSenderKey,
  saveMeta,
  loadMeta,
} from "./signalStore";

interface ChannelPayloadMeta {
  channelId: string;
  senderId: string;
  keyId: number;
}

async function aesGcmEncrypt(key: ArrayBuffer, plaintext: ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    plaintext,
  );
  const out = new Uint8Array(12 + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), 12);
  return out.buffer;
}

async function aesGcmDecrypt(key: ArrayBuffer, payload: ArrayBuffer): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(payload);
  const iv = bytes.slice(0, 12);
  const data = bytes.slice(12);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    "AES-GCM",
    false,
    ["decrypt"],
  );
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
}

function parseChannelEnvelope(stored: string): {
  keyId: number;
  payload: ArrayBuffer;
} | null {
  try {
    const inner = unwrapOpaquePayloadOnce(stored) ?? stored.trim();
    const parsed = JSON.parse(inner) as {
      keyId?: number;
      data?: string;
    };
    if (typeof parsed.keyId !== "number" || typeof parsed.data !== "string") {
      return null;
    }
    return {
      keyId: parsed.keyId,
      payload: base64ToArrayBuffer(parsed.data),
    };
  } catch {
    return null;
  }
}

export async function getOrCreateOwnSenderKey(
  channelId: string,
  senderId: string,
): Promise<ChannelPayloadMeta & { key: string }> {
  const metaKey = `channelKey:${channelId}:${senderId}`;
  const existing = await loadMeta<ChannelPayloadMeta & { key: string }>(metaKey);
  if (existing) return existing;

  const keyId = Math.floor(Math.random() * 0x7fffffff);
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const key = arrayBufferToBase64(raw.buffer);
  const record = { channelId, senderId, keyId, key };
  await saveMeta(metaKey, record);
  await saveChannelSenderKey(record);
  return record;
}

export async function rotateChannelSenderKey(
  channelId: string,
  senderId: string,
): Promise<ChannelPayloadMeta & { key: string }> {
  await clearChannelSenderKeys(channelId, senderId);
  return getOrCreateOwnSenderKey(channelId, senderId);
}

export async function storeReceivedSenderKey(input: {
  channelId: string;
  senderId: string;
  keyId: number;
  key: string;
}): Promise<void> {
  await saveChannelSenderKey(input);
}

export async function encryptChannelMessage(
  channelId: string,
  senderId: string,
  plaintext: string,
): Promise<{ content: string; e2eVersion: number; keyId: number; key: string }> {
  const senderKey = await getOrCreateOwnSenderKey(channelId, senderId);
  const encrypted = await aesGcmEncrypt(
    base64ToArrayBuffer(senderKey.key),
    utf8ToArrayBuffer(plaintext),
  );
  return {
    content: wrapOpaquePayload(
      JSON.stringify({
        keyId: senderKey.keyId,
        data: arrayBufferToBase64(encrypted),
      }),
    ),
    e2eVersion: E2E_VERSION_CHANNEL,
    keyId: senderKey.keyId,
    key: senderKey.key,
  };
}

export async function decryptChannelMessage(
  channelId: string,
  senderId: string,
  content: string,
): Promise<string> {
  const envelope = parseChannelEnvelope(content);
  if (!envelope) throw new Error("INVALID_CHANNEL_E2E");

  const maxAttempts = 12;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const record = await loadChannelSenderKey(channelId, senderId, envelope.keyId);
    if (record) {
      const plaintext = await aesGcmDecrypt(
        base64ToArrayBuffer(record.key),
        envelope.payload,
      );
      return new TextDecoder().decode(plaintext);
    }
    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw new Error("MISSING_SENDER_KEY");
}

export function buildSenderKeyDistribution(senderKey: {
  channelId: string;
  senderId: string;
  keyId: number;
  key: string;
}) {
  return {
    channelId: senderKey.channelId,
    senderId: senderKey.senderId,
    keyId: senderKey.keyId,
    key: senderKey.key,
  };
}
