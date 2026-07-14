import { normalizeReactions } from "./reactions";
import { userLabel } from "../user/format";
import { stripFormatting } from "./messageFormat";
import { resolveMediaUrl } from "../media/media";
import { MAX_MESSAGE_LENGTH } from "../../constants/messages";
import i18n from "../../i18n/config";
import type { Message, MessageUser } from "../../types";

function capContent(content: unknown): string {
  return typeof content === "string"
    ? content.slice(0, MAX_MESSAGE_LENGTH)
    : "";
}

// Waliduje, ale zwraca SUROWĄ wartość — komponenty renderujące same wywołują
// resolveMediaUrl(), które nie jest idempotentne (podwójne rozwiązanie → null).
function safeFileUrl(fileUrl: unknown): string | undefined {
  if (typeof fileUrl !== "string" || !fileUrl) return undefined;
  return resolveMediaUrl(fileUrl) ? fileUrl : undefined;
}

export function resolveQuotedMessage(
  quoted: Message["quotedMessage"],
): Message | null {
  if (!quoted || typeof quoted === "string") return null;
  return quoted;
}

export function getMessagePreview(
  message: Pick<Message, "content" | "messageType" | "fileName" | "deleted">,
): string {
  if (message.deleted) return i18n.t("messages.deleted");

  if (message.messageType && message.messageType !== "TEXT") {
    if (message.messageType === "STICKER") return i18n.t("messages.sticker");
    if (message.messageType === "IMAGE") return i18n.t("messages.image");
    if (message.messageType === "VIDEO") return i18n.t("messages.video");
    if (message.messageType === "AUDIO") return i18n.t("messages.audio");
    return message.fileName
      ? i18n.t("messages.file", { name: message.fileName })
      : i18n.t("messages.attachment");
  }

  const text = stripFormatting(message.content).trim();
  if (!text) return i18n.t("messages.default");
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export function getQuotedAuthorLabel(quoted: Message): string {
  const sender = quoted.sender;
  if (typeof sender === "string") return i18n.t("common.user");
  return userLabel(sender as MessageUser);
}

function normalizeQuotedMessageField(
  quoted: Message["quotedMessage"],
): Message["quotedMessage"] {
  if (!quoted || typeof quoted === "string") return quoted;
  return {
    ...quoted,
    content: capContent(quoted.content),
    fileUrl: safeFileUrl(quoted.fileUrl),
    reactions: normalizeReactions(quoted.reactions),
  };
}

export function normalizeMessage(message: Message): Message {
  return {
    ...message,
    content: capContent(message.content),
    fileUrl: safeFileUrl(message.fileUrl),
    reactions: normalizeReactions(message.reactions),
    quotedMessage: normalizeQuotedMessageField(message.quotedMessage),
  };
}
