import { unwrapOpaquePayload, wrapOpaquePayload } from "./e2e/opaquePayload";
import type { Message } from "../types";

export function isSignalEnvelopeContent(stored: string): boolean {
  try {
    const inner = unwrapOpaquePayload(stored.trim());
    if (!inner.startsWith("{")) return false;
    const parsed = JSON.parse(inner) as { type?: unknown; body?: unknown };
    return typeof parsed.type === "number" && typeof parsed.body === "string";
  } catch {
    return false;
  }
}

/** Human-readable body for UI previews (list, quotes) — API may still return opaque. */
export function readableContentForPreview(
  content: string,
  e2eEncrypted?: boolean,
): string {
  if (!content.trim()) return content;
  if (e2eEncrypted) {
    if (isSignalEnvelopeContent(content)) return "";
    return content;
  }
  if (isSignalEnvelopeContent(content)) return "";
  return unwrapOpaquePayload(content);
}

export function wrapOutgoingContent(plaintext: string): string {
  return wrapOpaquePayload(plaintext);
}

export function unwrapIncomingMessage(message: Message): Message {
  if (message.e2eEncrypted) return message;
  return {
    ...message,
    content: unwrapOpaquePayload(message.content),
  };
}

export function unwrapIncomingMessages(messages: Message[]): Message[] {
  return messages.map(unwrapIncomingMessage);
}
