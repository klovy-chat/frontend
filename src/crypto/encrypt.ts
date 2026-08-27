// encrypt.ts
// Wrap/unwrap treści wiadomości do transportu.
// Zakres:
//  - UI: odwijaj tylko kopertę k1., reszta treści bez zgadywania
//  - wrap wychodzących; API i tak zwraca plaintext
// Przy zmianach: opaque/payload.ts, utils/messages/storage.rs.

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
