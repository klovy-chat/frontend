import { api } from "./client";

export interface E2eStatus {
  enabled: boolean;
  hasKeys: boolean;
  registrationId?: number;
  fingerprint?: string;
  oneTimePreKeysRemaining?: number;
}

export interface SignedPreKeyRecord {
  id: number;
  publicKey: string;
  signature: string;
}

export interface OneTimePreKeyRecord {
  id: number;
  publicKey: string;
}

export interface PublicPreKeyBundle {
  userId: string;
  registrationId: number;
  identityKey: string;
  identityFingerprint: string;
  signedPreKey: SignedPreKeyRecord;
  oneTimePreKey?: OneTimePreKeyRecord;
  e2eEnabled: boolean;
}

export interface E2eCapability {
  userId: string;
  e2eEnabled: boolean;
  hasKeys: boolean;
  fingerprint?: string;
}

export function getE2eStatus() {
  return api.get<E2eStatus>("/api/e2e/status");
}

export function patchE2eSettings(enabled: boolean) {
  return api.patch<{ enabled: boolean }>("/api/e2e/settings", { enabled });
}

export function putE2eKeys(body: {
  registrationId: number;
  identityKey: string;
  signedPreKey: SignedPreKeyRecord;
  oneTimePreKeys: OneTimePreKeyRecord[];
}) {
  return api.put<{
    success: boolean;
    fingerprint: string;
    oneTimePreKeysRemaining: number;
  }>("/api/e2e/keys", body);
}

export function appendE2ePreKeys(oneTimePreKeys: OneTimePreKeyRecord[]) {
  return api.post<{ oneTimePreKeysRemaining: number }>(
    "/api/e2e/keys/prekeys",
    { oneTimePreKeys },
  );
}

export function deleteE2eKeys() {
  return api.delete<{ success: boolean }>("/api/e2e/keys");
}

export function fetchPreKeyBundle(userId: string) {
  return api.get<PublicPreKeyBundle>(`/api/e2e/keys/${userId}`);
}

export function fetchPeerFingerprint(userId: string) {
  return api.get<{ userId: string; fingerprint: string }>(
    `/api/e2e/keys/${userId}/fingerprint`,
  );
}

export function fetchPreKeyBundlesBulk(userIds: string[]) {
  const ids = userIds.filter(Boolean).join(",");
  if (!ids) return Promise.resolve({ bundles: [] as PublicPreKeyBundle[] });
  return api.get<{ bundles: PublicPreKeyBundle[] }>(
    `/api/e2e/keys/bulk?ids=${encodeURIComponent(ids)}`,
  );
}

export function fetchE2eCapabilities(userIds: string[]) {
  const ids = userIds.filter(Boolean).join(",");
  if (!ids) return Promise.resolve({ users: [] as E2eCapability[] });
  return api.get<{ users: E2eCapability[] }>(
    `/api/e2e/capabilities?ids=${encodeURIComponent(ids)}`,
  );
}
