// messages.ts
// Normalizacja Message, preview, cytat, legacy opaque w tekście listy.
// Zakres:
//  - resolveQuotedMessage
//  - normalizacja Message, cytat, legacy opaque na liście
// Zmiana preview listy: też preview.ts (tip) i formatListLastMessage.
// Przy zmianach: ChatWindow.tsx, preview.ts, format.tsx.

import { normalizeReactions } from "./reactions";
import { userLabel } from "../user/format";
import { stripFormatting } from "./format";
import { resolveMediaUrl } from "../media/media";
import { MAX_MESSAGE_LENGTH } from "../../constants/messages";
import i18n from "../../i18n/config";
import {
  extractExternalMediaLinks,
  isOnlyExternalMediaContent,
} from "../media/mediaLinks";
import { isVideoAttachment, isVoiceAttachment } from "../media/attachments";
import type { Message, MessageUser } from "../../types";
import {
  readableContentForPreview,
} from "../../crypto/encrypt";

function capContent(content: unknown): string {
  return typeof content === "string"
    ? content.slice(0, MAX_MESSAGE_LENGTH)
    : "";
}

function safeFileUrl(fileUrl: unknown): string | undefined {
  if (typeof fileUrl !== "string" || !fileUrl) return undefined;
  return resolveMediaUrl(fileUrl) ? fileUrl : undefined;
}

function visibleFileUrl(
  scanStatus: Message["scanStatus"],
  fileUrl: unknown,
): string | undefined {
  if (scanStatus === "pending" || scanStatus === "blocked") return undefined;
  return safeFileUrl(fileUrl);
}

export function resolveQuotedMessage(
  quoted: Message["quotedMessage"],
): Message | null {
  if (!quoted || typeof quoted === "string") return null;
  return quoted;
}

export function getMessagePreview(
  message: Pick<
    Message,
    | "content"
    | "fileUrl"
    | "messageType"
    | "fileType"
    | "fileName"
    | "durationMs"
    | "scanStatus"
    | "deleted"
  >,
): string {
  if (message.deleted) return i18n.t("messages.deleted");
  if (message.scanStatus === "blocked") return i18n.t("messages.scanBlocked");
  if (message.scanStatus === "pending") return i18n.t("messages.scanPending");

  const readable = readableContentForPreview(message.content);

  if (isOnlyExternalMediaContent(readable)) {
    const media = extractExternalMediaLinks(readable);
    if (media.length === 1 && media[0].kind === "gif") {
      return i18n.t("messages.image");
    }
    if (media.length === 1) {
      return i18n.t("messages.image");
    }
  }

  if (message.messageType && message.messageType !== "TEXT") {
    if (message.messageType === "STICKER") return i18n.t("messages.sticker");
    if (message.messageType === "IMAGE") return i18n.t("messages.image");
    if (isVideoAttachment(message)) return i18n.t("messages.video");
    if (isVoiceAttachment(message)) return i18n.t("messages.audio");
    if (message.messageType === "CALL") {
      return (message.durationMs ?? 0) > 0
        ? i18n.t("messages.call")
        : i18n.t("chat.missedCall");
    }
    return message.fileName
      ? i18n.t("messages.file", { name: message.fileName })
      : i18n.t("messages.attachment");
  }

  const text = stripFormatting(readable).trim();
  if (!text) return i18n.t("messages.default");
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

export function formatListLastMessage(raw?: string): string {
  if (!raw?.trim()) return "";
  const text = stripFormatting(readableContentForPreview(raw)).trim();
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
  const raw = typeof quoted.content === "string" ? quoted.content : "";
  return {
    ...quoted,
    content: capContent(readableContentForPreview(raw)),
    fileUrl: visibleFileUrl(quoted.scanStatus, quoted.fileUrl),
    reactions: normalizeReactions(quoted.reactions),
  };
}

export function normalizeMessage(message: Message): Message {
  const raw = typeof message.content === "string" ? message.content : "";
  return {
    ...message,
    content: capContent(readableContentForPreview(raw)),
    fileUrl: visibleFileUrl(message.scanStatus, message.fileUrl),
    reactions: normalizeReactions(message.reactions),
    quotedMessage: normalizeQuotedMessageField(message.quotedMessage),
  };
}
