import { unwrapOpaquePayload, wrapOpaquePayload } from "./opaque/opaquePayload";
import type { Message } from "../types";

/** Human-readable body for UI — API returns plaintext; peel legacy opaque wraps. */
export function readableContentForPreview(content: string): string {
  if (!content.trim()) return content;
  return unwrapOpaquePayload(content);
}

export function wrapOutgoingContent(plaintext: string): string {
  return wrapOpaquePayload(plaintext);
}

/** Unwrap transport opaque for display. */
export function unwrapIncomingMessage(message: Message): Message {
  return {
    ...message,
    content: unwrapOpaquePayload(message.content),
  };
}

export function unwrapIncomingMessages(messages: Message[]): Message[] {
  return messages.map(unwrapIncomingMessage);
}
