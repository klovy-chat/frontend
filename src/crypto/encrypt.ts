// encrypt.ts
// Wrap/unwrap treści wiadomości do transportu.
// Zakres:
//  - zdejmuje legacy opaque przy preview
//  - koperta treści do transportu; legacy opaque zdejmowane przy preview
// Zmiana formatu koperty = breaking starych wiadomości (jest migracja na BE).
// Przy zmianach: opaque/payload.ts, utils/crypto/encrypt.rs.

import { unwrapOpaquePayload, wrapOpaquePayload } from "./opaque/payload";
import type { Message } from "../types";

export function readableContentForPreview(content: string): string {
  if (!content.trim()) return content;
  return unwrapOpaquePayload(content);
}

export function wrapOutgoingContent(plaintext: string): string {
  return wrapOpaquePayload(plaintext);
}

export function unwrapIncomingMessage(message: Message): Message {
  return {
    ...message,
    content: unwrapOpaquePayload(message.content),
  };
}

export function unwrapIncomingMessages(messages: Message[]): Message[] {
  return messages.map(unwrapIncomingMessage);
}
