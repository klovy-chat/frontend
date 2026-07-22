import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "../bufferUtils";
import { wrapOpaquePayload } from "../opaquePayload";

export interface E2eAttachmentMeta {
  _e2eAttachment: true;
  fileName: string;
  fileType: string;
  fileKey: string;
  fileIv: string;
}

async function aesGcmEncrypt(key: ArrayBuffer, iv: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["encrypt"]);
  return crypto.subtle.encrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, cryptoKey, data);
}

async function aesGcmDecrypt(key: ArrayBuffer, iv: ArrayBuffer, data: ArrayBuffer): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, "AES-GCM", false, ["decrypt"]);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, cryptoKey, data);
}

export async function encryptFileForE2e(file: File): Promise<{
  encryptedBlob: Blob;
  meta: E2eAttachmentMeta;
  innerContent: string;
}> {
  const fileKey = crypto.getRandomValues(new Uint8Array(32));
  const fileIv = crypto.getRandomValues(new Uint8Array(12));
  const plain = await file.arrayBuffer();
  const ciphertext = await aesGcmEncrypt(fileKey.buffer, fileIv.buffer, plain);

  const meta: E2eAttachmentMeta = {
    _e2eAttachment: true,
    fileName: file.name,
    fileType: file.type || "application/octet-stream",
    fileKey: arrayBufferToBase64(fileKey.buffer),
    fileIv: arrayBufferToBase64(fileIv.buffer),
  };

  return {
    encryptedBlob: new Blob([ciphertext], { type: "application/octet-stream" }),
    meta,
    innerContent: JSON.stringify(meta),
  };
}

export function isE2eAttachmentMeta(value: unknown): value is E2eAttachmentMeta {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<E2eAttachmentMeta>;
  return (
    row._e2eAttachment === true &&
    typeof row.fileName === "string" &&
    typeof row.fileType === "string" &&
    typeof row.fileKey === "string" &&
    typeof row.fileIv === "string"
  );
}

export async function decryptFileFromE2e(
  encryptedBytes: ArrayBuffer,
  meta: E2eAttachmentMeta,
): Promise<Blob> {
  const key = base64ToArrayBuffer(meta.fileKey);
  const iv = base64ToArrayBuffer(meta.fileIv);
  const plain = await aesGcmDecrypt(key, iv, encryptedBytes);
  return new Blob([plain], { type: meta.fileType });
}

export function buildAttachmentPlaceholderContent(meta: E2eAttachmentMeta): string {
  return wrapOpaquePayload(JSON.stringify(meta));
}
