import {
  KeyHelper,
  SessionBuilder,
  SessionCipher,
  SignalProtocolAddress,
} from "@privacyresearch/libsignal-protocol-typescript";
import type { DeviceType } from "@privacyresearch/libsignal-protocol-typescript/lib/session-types";
import type { PublicPreKeyBundle } from "./prekeyClient";
import {
  appendE2ePreKeys,
  fetchPreKeyBundle,
  putE2eKeys,
} from "./prekeyClient";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
  utf8ToArrayBuffer,
} from "../bufferUtils";
import { unwrapOpaquePayload, wrapOpaquePayload } from "../opaquePayload";
import { assertPeerIdentityTrusted } from "./identityTrust";
import { DEVICE_ID, E2E_VERSION_DM } from "../types";
import { ensureSignalInit } from "./signalInit";
import { saveMeta, signalProtocolStore } from "./signalStore";

const PREKEY_BATCH = 20;
const PREKEY_LOW_WATER = 5;

function randomKeyId(): number {
  return Math.floor(Math.random() * 0x3fff) + 1;
}

export async function generateAndUploadKeyBundle(): Promise<string> {
  await ensureSignalInit();

  const registrationId = KeyHelper.generateRegistrationId();
  const identityKeyPair = await KeyHelper.generateIdentityKeyPair();
  await saveMeta("registrationId", registrationId);
  await saveMeta("identityKey", {
    pubKey: arrayBufferToBase64(identityKeyPair.pubKey),
    privKey: arrayBufferToBase64(identityKeyPair.privKey),
  });

  const oneTimePreKeys = [];
  for (let i = 0; i < PREKEY_BATCH; i += 1) {
    const keyId = randomKeyId();
    const preKey = await KeyHelper.generatePreKey(keyId);
    await signalProtocolStore.storePreKey(keyId, preKey.keyPair);
    oneTimePreKeys.push({
      id: keyId,
      publicKey: arrayBufferToBase64(preKey.keyPair.pubKey),
    });
  }

  const signedPreKeyId = randomKeyId();
  const signedPreKey = await KeyHelper.generateSignedPreKey(
    identityKeyPair,
    signedPreKeyId,
  );
  await signalProtocolStore.storeSignedPreKey(
    signedPreKeyId,
    signedPreKey.keyPair,
  );

  const res = await putE2eKeys({
    registrationId,
    identityKey: arrayBufferToBase64(identityKeyPair.pubKey),
    signedPreKey: {
      id: signedPreKeyId,
      publicKey: arrayBufferToBase64(signedPreKey.keyPair.pubKey),
      signature: arrayBufferToBase64(signedPreKey.signature),
    },
    oneTimePreKeys,
  });

  return res.fingerprint;
}

export async function replenishPreKeysIfNeeded(remaining: number): Promise<void> {
  if (remaining > PREKEY_LOW_WATER) return;
  await ensureSignalInit();
  const oneTimePreKeys = [];
  for (let i = 0; i < PREKEY_BATCH; i += 1) {
    const keyId = randomKeyId();
    const preKey = await KeyHelper.generatePreKey(keyId);
    await signalProtocolStore.storePreKey(keyId, preKey.keyPair);
    oneTimePreKeys.push({
      id: keyId,
      publicKey: arrayBufferToBase64(preKey.keyPair.pubKey),
    });
  }
  await appendE2ePreKeys(oneTimePreKeys);
}

function bundleToDevice(bundle: PublicPreKeyBundle): DeviceType {
  return {
    identityKey: base64ToArrayBuffer(bundle.identityKey),
    registrationId: bundle.registrationId,
    signedPreKey: {
      keyId: bundle.signedPreKey.id,
      publicKey: base64ToArrayBuffer(bundle.signedPreKey.publicKey),
      signature: base64ToArrayBuffer(bundle.signedPreKey.signature),
    },
    preKey: bundle.oneTimePreKey
      ? {
          keyId: bundle.oneTimePreKey.id,
          publicKey: base64ToArrayBuffer(bundle.oneTimePreKey.publicKey),
        }
      : undefined,
  };
}

export async function ensureSessionWithPeer(peerId: string): Promise<void> {
  await ensureSignalInit();
  const address = new SignalProtocolAddress(peerId, DEVICE_ID);
  const cipher = new SessionCipher(signalProtocolStore, address);
  if (await cipher.hasOpenSession()) return;

  const bundle = await fetchPreKeyBundle(peerId);
  await assertPeerIdentityTrusted(
    peerId,
    bundle.identityKey,
    bundle.identityFingerprint,
  );
  const builder = new SessionBuilder(signalProtocolStore, address);
  await builder.processPreKey(bundleToDevice(bundle));
}

function serializeSignalBody(type: number, body: string | ArrayBuffer): string {
  const bodyB64 =
    typeof body === "string" ? body : arrayBufferToBase64(body);
  return JSON.stringify({ type, body: bodyB64 });
}

function parseSignalPayload(stored: string): { type: number; body: string } | null {
  try {
    const inner = unwrapOpaquePayload(stored);
    const parsed = JSON.parse(inner) as { type?: number; body?: string };
    if (typeof parsed.type !== "number" || typeof parsed.body !== "string") {
      return null;
    }
    return { type: parsed.type, body: parsed.body };
  } catch {
    return null;
  }
}

export async function encryptDm(
  peerId: string,
  plaintext: string,
): Promise<{ content: string; e2eVersion: number }> {
  await ensureSessionWithPeer(peerId);
  const address = new SignalProtocolAddress(peerId, DEVICE_ID);
  const cipher = new SessionCipher(signalProtocolStore, address);
  const encrypted = await cipher.encrypt(utf8ToArrayBuffer(plaintext));
  const body = encrypted.body ?? "";
  return {
    content: wrapOpaquePayload(serializeSignalBody(encrypted.type, body)),
    e2eVersion: E2E_VERSION_DM,
  };
}

export async function decryptDm(
  senderId: string,
  content: string,
): Promise<string> {
  await ensureSignalInit();
  const payload = parseSignalPayload(content);
  if (!payload) throw new Error("INVALID_E2E_PAYLOAD");

  const address = new SignalProtocolAddress(senderId, DEVICE_ID);
  const cipher = new SessionCipher(signalProtocolStore, address);
  const bodyBuffer = base64ToArrayBuffer(payload.body);
  const plaintext =
    payload.type === 3
      ? await cipher.decryptPreKeyWhisperMessage(bodyBuffer)
      : await cipher.decryptWhisperMessage(bodyBuffer);
  return new TextDecoder().decode(plaintext);
}

export async function encryptDistributionPayload(
  recipientId: string,
  payload: unknown,
): Promise<string> {
  const json = JSON.stringify(payload);
  const result = await encryptDm(recipientId, json);
  return result.content;
}

export async function decryptDistributionPayload(
  senderId: string,
  storedContent: string,
): Promise<unknown> {
  const json = await decryptDm(senderId, storedContent);
  return JSON.parse(json) as unknown;
}
