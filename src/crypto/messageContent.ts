import { unwrapOpaquePayload, wrapOpaquePayload, unwrapOpaquePayloadOnce } from "./e2e/opaquePayload";
import type { Message } from "../types";

function parseOpaqueJsonEnvelope(
  stored: string,
): Record<string, unknown> | null {
  try {
    const inner =
      unwrapOpaquePayloadOnce(stored.trim()) ?? stored.trim();
    if (!inner.startsWith("{")) return null;
    return JSON.parse(inner) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function isSignalEnvelopeContent(stored: string): boolean {
  const parsed = parseOpaqueJsonEnvelope(stored);
  if (!parsed) return false;
  return typeof parsed.type === "number" && typeof parsed.body === "string";
}

export function isChannelEnvelopeContent(stored: string): boolean {
  const parsed = parseOpaqueJsonEnvelope(stored);
  if (!parsed) return false;
  return typeof parsed.keyId === "number" && typeof parsed.data === "string";
}

/** True only for actual E2E ciphertext shapes — not plain opaque transport wrap. */
export function isE2eCiphertextContent(content: string): boolean {
  return isSignalEnvelopeContent(content) || isChannelEnvelopeContent(content);
}

export function looksLikeE2eContent(content: string): boolean {
  return isE2eCiphertextContent(content);
}

/** Hide ciphertext in UI when this device cannot decrypt yet. */
export function maskUndecryptableMessage(message: Message): Message {
  if (!isE2eCiphertextContent(message.content)) {
    return message;
  }
  if (message.e2eDecryptFailed) return message;
  return {
    ...message,
    content: "",
    e2eEncrypted: true,
    e2eDecryptFailed: true,
  };
}

export function maskUndecryptableMessages(messages: Message[]): Message[] {
  return messages.map(maskUndecryptableMessage);
}

/** Human-readable body for UI previews (list, quotes) — API may still return opaque. */
export function readableContentForPreview(
  content: string,
  e2eEncrypted?: boolean,
): string {
  if (!content.trim()) return content;
  if (isE2eCiphertextContent(content)) return "";
  if (e2eEncrypted) return "";
  return unwrapOpaquePayload(content);
}

export function wrapOutgoingContent(plaintext: string): string {
  return wrapOpaquePayload(plaintext);
}

/** Unwrap transport opaque for display. Real E2E ciphertext stays sealed until decrypt. */
export function unwrapIncomingMessage(message: Message): Message {
  if (isE2eCiphertextContent(message.content)) {
    return message;
  }
  return {
    ...message,
    content: unwrapOpaquePayload(message.content),
  };
}

export function unwrapIncomingMessages(messages: Message[]): Message[] {
  return messages.map(unwrapIncomingMessage);
}
