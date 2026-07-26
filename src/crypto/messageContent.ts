import { unwrapOpaquePayload, wrapOpaquePayload } from "./e2e/opaquePayload";
import type { Message } from "../types";

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
