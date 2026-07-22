import { arrayBufferToBase64, base64ToArrayBuffer } from "../bufferUtils";

import { idbGet, idbPut } from "./e2eDb";

const IDENTITY_CHANGE_EVENT = "klovy:e2e-identity-changed";

export interface IdentityChangeDetail {
  peerId: string;
  previousFingerprint: string | null;
  nextFingerprint: string;
}

export function onIdentityChange(listener: (detail: IdentityChangeDetail) => void): () => void {
  const handler = (event: Event) => {
    listener((event as CustomEvent<IdentityChangeDetail>).detail);
  };
  window.addEventListener(IDENTITY_CHANGE_EVENT, handler);
  return () => window.removeEventListener(IDENTITY_CHANGE_EVENT, handler);
}

function emitIdentityChange(detail: IdentityChangeDetail) {
  window.dispatchEvent(new CustomEvent(IDENTITY_CHANGE_EVENT, { detail }));
}

async function metaGet<T>(key: string): Promise<T | undefined> {
  return idbGet<T>("meta", key);
}

async function metaPut(key: string, value: unknown): Promise<void> {
  await idbPut("meta", key, value);
}

export async function fingerprintFromIdentityKeyB64(identityKeyB64: string): Promise<string> {
  const raw = base64ToArrayBuffer(identityKeyB64.trim());
  const hash = await crypto.subtle.digest("SHA-256", raw);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function loadTrustedIdentityFingerprint(peerId: string): Promise<string | null> {
  const stored = await metaGet<{ fingerprint: string }>(`trustedIdentity:${peerId}`);
  return stored?.fingerprint ?? null;
}

export async function assertPeerIdentityTrusted(
  peerId: string,
  identityKeyB64: string,
  serverFingerprint?: string,
): Promise<void> {
  const fingerprint =
    serverFingerprint ?? (await fingerprintFromIdentityKeyB64(identityKeyB64));
  const stored = await metaGet<{ identityKey: string; fingerprint: string }>(
    `trustedIdentity:${peerId}`,
  );

  if (!stored) {
    await metaPut(`trustedIdentity:${peerId}`, {
      identityKey: identityKeyB64,
      fingerprint,
    });
    return;
  }

  if (stored.fingerprint !== fingerprint) {
    emitIdentityChange({
      peerId,
      previousFingerprint: stored.fingerprint,
      nextFingerprint: fingerprint,
    });
    await metaPut(`trustedIdentity:${peerId}`, {
      identityKey: identityKeyB64,
      fingerprint,
    });
  }
}

export async function compareIdentityKey(
  storedKey: ArrayBuffer,
  incomingKey: ArrayBuffer,
): Promise<boolean> {
  if (storedKey.byteLength !== incomingKey.byteLength) return false;
  const a = new Uint8Array(storedKey);
  const b = new Uint8Array(incomingKey);
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export async function loadStoredIdentityKey(peerId: string): Promise<ArrayBuffer | null> {
  const stored = await metaGet<{ identityKey: string }>(`trustedIdentity:${peerId}`);
  if (!stored?.identityKey) return null;
  return base64ToArrayBuffer(stored.identityKey);
}

export async function persistIdentityKey(peerId: string, identityKey: ArrayBuffer): Promise<void> {
  const identityKeyB64 = arrayBufferToBase64(identityKey);
  const fingerprint = await fingerprintFromIdentityKeyB64(identityKeyB64);
  const existing = await metaGet<{ fingerprint: string }>(`trustedIdentity:${peerId}`);
  if (existing && existing.fingerprint !== fingerprint) {
    emitIdentityChange({
      peerId,
      previousFingerprint: existing.fingerprint,
      nextFingerprint: fingerprint,
    });
  }
  await metaPut(`trustedIdentity:${peerId}`, { identityKey: identityKeyB64, fingerprint });
}

export async function getClearKeysOnLogout(): Promise<boolean> {
  const value = await metaGet<boolean>("clearKeysOnLogout");
  return value !== false;
}

export async function setClearKeysOnLogout(enabled: boolean): Promise<void> {
  await metaPut("clearKeysOnLogout", enabled);
}

export async function clearLocalKeysIfConfigured(): Promise<void> {
  if (!(await getClearKeysOnLogout())) return;
  const { clearE2eStore } = await import("./signalStore");
  await clearE2eStore();
}
