export const E2E_VERSION_DM = 1;
export const E2E_VERSION_CHANNEL = 2;

export const DEVICE_ID = 1;

export interface E2EEncryptResult {
  content: string;
  e2eEncrypted: true;
  e2eVersion: number;
}

export interface E2EDecryptResult {
  plaintext: string;
  failed?: boolean;
}

export interface E2ECapabilityMap {
  [userId: string]: {
    e2eEnabled: boolean;
    hasKeys: boolean;
    fingerprint?: string;
  };
}
