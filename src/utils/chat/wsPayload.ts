import { MAX_MESSAGE_LENGTH } from "../../constants/messages";
import { resolveMediaUrl } from "../media/media";

const OBJECT_ID = /^[a-f0-9]{24}$/i;
const MAX_GENERIC_STRING = 2048;

// Płytkie ograniczenie długości ciągów na poziomie top-level — obrona wgłębna
// dla zdarzeń bez dedykowanego schematu (profil, odznaki, połączenia, itp.),
// by nadmiarowe stringi z WS nie trafiały do stanu React. Zagnieżdżone obiekty
// są walidowane w warstwie renderu (allowlisty mediów, sanityzacja odznak).
// Sanityzuje zagnieżdżoną wiadomość cytowaną: przycina treść i waliduje media
// (zachowując surową wartość dla resolveMediaUrl przy renderze).
function sanitizeQuoted(quoted: unknown): unknown {
  if (!quoted || typeof quoted !== "object" || Array.isArray(quoted)) {
    return quoted;
  }
  const q = quoted as Record<string, unknown>;
  const content =
    typeof q.content === "string"
      ? q.content.slice(0, MAX_MESSAGE_LENGTH)
      : q.content;
  const fileUrl =
    typeof q.fileUrl === "string" && resolveMediaUrl(q.fileUrl)
      ? q.fileUrl
      : undefined;
  return { ...q, content, fileUrl };
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
      // Waliduje, ale zachowuje SUROWĄ wartość — render sam wywołuje
      // resolveMediaUrl() (nie jest idempotentne: podwójne rozwiązanie → null).
      const fileUrl =
        typeof record.fileUrl === "string" && resolveMediaUrl(record.fileUrl)
          ? record.fileUrl
          : undefined;
      return {
        ...record,
        content,
        fileUrl,
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
