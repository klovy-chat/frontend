// socketPayload.ts
// Budowa payloadów WS (send, edit, typing, react).
// Zakres:
//  - jedno miejsce na kształt ramki
//  - kształt send/edit/typing/react — deserializer w handlers.rs
// Pole w payloadzie = deserializer w handlers.rs.
// Przy zmianach: ChatWindow.tsx, api/protocol.ts, ws/handlers.rs.

import { MAX_MESSAGE_LENGTH } from "../../constants/messages";
import { resolveMediaUrl } from "../media/media";

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const MAX_GENERIC_STRING = 2048;

function sanitizeQuoted(quoted: unknown): unknown {
  if (!quoted || typeof quoted !== "object" || Array.isArray(quoted)) {
    return quoted;
  }
  const q = quoted as Record<string, unknown>;
  const content =
    typeof q.content === "string"
      ? q.content.slice(0, MAX_MESSAGE_LENGTH)
      : q.content;
  const scanStatus =
    q.scanStatus === "pending" ||
    q.scanStatus === "clean" ||
    q.scanStatus === "blocked"
      ? q.scanStatus
      : undefined;
  const fileUrl =
    scanStatus === "pending" || scanStatus === "blocked"
      ? undefined
      : typeof q.fileUrl === "string" && resolveMediaUrl(q.fileUrl)
        ? q.fileUrl
        : undefined;
  return { ...q, content, fileUrl, scanStatus };
}

function capGenericStrings(
  record: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] =
      typeof value === "string" ? value.slice(0, MAX_GENERIC_STRING) : value;
  }
  return out;
}

export function sanitizeWsPayload(type: string, payload: unknown): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;

  switch (type) {
    case "receiveMessage":
    case "receive-channel-message":
    case "message-edited":
    case "message":
    case "channel-message":
    case "channel-message-edited": {
      const content =
        typeof record.content === "string"
          ? record.content.slice(0, MAX_MESSAGE_LENGTH)
          : "";

      const scanStatus =
        record.scanStatus === "pending" ||
        record.scanStatus === "clean" ||
        record.scanStatus === "blocked"
          ? record.scanStatus
          : undefined;
      const fileUrl =
        scanStatus === "pending" || scanStatus === "blocked"
          ? undefined
          : typeof record.fileUrl === "string" && resolveMediaUrl(record.fileUrl)
            ? record.fileUrl
            : undefined;
      return {
        ...record,
        content,
        fileUrl,
        scanStatus,
        quotedMessage: sanitizeQuoted(record.quotedMessage),
      };
    }
    case "typing": {
      const chatId =
        typeof record.chatId === "string" ? record.chatId.slice(0, 128) : "";
      const userId =
        typeof record.userId === "string" && OBJECT_ID.test(record.userId)
          ? record.userId
          : "";
      return {
        chatId,
        userId,
        isTyping: Boolean(record.isTyping),
      };
    }
    case "user-status-changed": {
      const userId =
        typeof record.userId === "string" && OBJECT_ID.test(record.userId)
          ? record.userId
          : "";
      return userId ? { ...record, userId } : null;
    }
    case "session:revoked":
      return {};
    default:
      return capGenericStrings(record);
  }
}
