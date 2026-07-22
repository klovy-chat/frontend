import type { KeyPairType, StorageType } from "@privacyresearch/libsignal-protocol-typescript";
import { Direction } from "@privacyresearch/libsignal-protocol-typescript";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../bufferUtils";
import {
  compareIdentityKey,
  loadStoredIdentityKey,
  persistIdentityKey,
} from "./identityTrust";
import { idbDelete, idbGet, idbPut, openE2eDb, type E2eStoreName } from "./e2eDb";

type StoreName = E2eStoreName;

export async function clearE2eStore(): Promise<void> {
  const db = await openE2eDb();
  const stores: StoreName[] = [
    "meta",
    "preKeys",
    "signedPreKeys",
    "sessions",
    "channelSenderKeys",
  ];
  await Promise.all(
    stores.map(
      (store) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(store, "readwrite");
          tx.objectStore(store).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        }),
    ),
  );
}

export interface ChannelSenderKeyRecord {
  channelId: string;
  senderId: string;
  keyId: number;
  key: string;
}

export async function saveChannelSenderKey(record: ChannelSenderKeyRecord): Promise<void> {
  const key = `${record.channelId}:${record.senderId}:${record.keyId}`;
  await idbPut("channelSenderKeys", key, record);
}

export async function loadChannelSenderKey(
  channelId: string,
  senderId: string,
  keyId: number,
): Promise<ChannelSenderKeyRecord | undefined> {
  return idbGet<ChannelSenderKeyRecord>(
    "channelSenderKeys",
    `${channelId}:${senderId}:${keyId}`,
  );
}

export async function clearChannelSenderKeys(channelId: string, senderId: string): Promise<void> {
  const db = await openE2eDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("channelSenderKeys", "readwrite");
    const store = tx.objectStore("channelSenderKeys");
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      const key = String(cursor.key);
      if (key.startsWith(`${channelId}:${senderId}:`)) {
        cursor.delete();
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await idbDelete("meta", `channelKey:${channelId}:${senderId}`);
}

export async function saveMeta(key: string, value: unknown): Promise<void> {
  await idbPut("meta", key, value);
}

export async function loadMeta<T>(key: string): Promise<T | undefined> {
  return idbGet<T>("meta", key);
}

export async function hasLocalE2eKeys(): Promise<boolean> {
  try {
    const identity = await loadMeta<{ pubKey?: string }>("identityKey");
    return Boolean(identity?.pubKey);
  } catch {
    return false;
  }
}

function parsePeerIdFromAddress(encodedAddress: string): string {
  const dot = encodedAddress.indexOf(".");
  return dot >= 0 ? encodedAddress.slice(0, dot) : encodedAddress;
}

function serializeKeyPair(pair: KeyPairType): KeyPairType<string> {
  return {
    pubKey: arrayBufferToBase64(pair.pubKey),
    privKey: arrayBufferToBase64(pair.privKey),
  };
}

function deserializeKeyPair(pair: KeyPairType<string>): KeyPairType {
  return {
    pubKey: base64ToArrayBuffer(pair.pubKey),
    privKey: base64ToArrayBuffer(pair.privKey),
  };
}

export const signalProtocolStore: StorageType = {
  getIdentityKeyPair: async () => {
    const stored = await loadMeta<KeyPairType<string>>("identityKey");
    return stored ? deserializeKeyPair(stored) : undefined;
  },
  getLocalRegistrationId: async () => loadMeta<number>("registrationId"),
  isTrustedIdentity: async (identifier, identityKey, direction) => {
    const peerId = parsePeerIdFromAddress(identifier);
    const stored = await loadStoredIdentityKey(peerId);
    if (!stored) {
      if (direction === Direction.SENDING || direction === Direction.RECEIVING) {
        await persistIdentityKey(peerId, identityKey);
      }
      return true;
    }
    return compareIdentityKey(stored, identityKey);
  },
  saveIdentity: async (encodedAddress, publicKey, _nonblockingApproval) => {
    const peerId = parsePeerIdFromAddress(encodedAddress);
    await persistIdentityKey(peerId, publicKey);
    return true;
  },
  loadPreKey: async (keyId) => {
    const stored = await idbGet<KeyPairType<string>>("preKeys", String(keyId));
    return stored ? deserializeKeyPair(stored) : undefined;
  },
  storePreKey: async (keyId, keyPair) => {
    await idbPut("preKeys", String(keyId), serializeKeyPair(keyPair));
  },
  removePreKey: async (keyId) => {
    await idbDelete("preKeys", String(keyId));
  },
  storeSession: async (encodedAddress, record) => {
    await idbPut("sessions", encodedAddress, record);
  },
  loadSession: async (encodedAddress) => idbGet("sessions", encodedAddress),
  loadSignedPreKey: async (keyId) => {
    const stored = await idbGet<KeyPairType<string>>("signedPreKeys", String(keyId));
    return stored ? deserializeKeyPair(stored) : undefined;
  },
  storeSignedPreKey: async (keyId, keyPair) => {
    await idbPut("signedPreKeys", String(keyId), serializeKeyPair(keyPair));
  },
  removeSignedPreKey: async (keyId) => {
    await idbDelete("signedPreKeys", String(keyId));
  },
};

export { Direction };
