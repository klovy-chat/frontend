// resend.ts
// Po reconnect: drop starych pending, ponów młode.
// Zakres:
//  - soft !sent zostaje do TTL; throw = drop
//  - po reconnect: drop starych pending, ponów młode z nonce
// Nonce musi przeżyć w cache — inaczej duplikat na serwerze (idempotencja).
// Przy zmianach: messageCache.ts, model/messages.rs (nonce).

import { WsType } from "../../api/protocol";
import { wrapOutgoingContent } from "../../crypto/encrypt";
import type { Message } from "../../types";
import {
  collectYoungPendingFromAllCaches,
  dropPendingNonceFromCache,
  PENDING_MESSAGE_TTL_MS,
  scrubStalePendingInAllCaches,
  staleAllMessagePageCaches,
} from "./messageCache";

type WsLike = {
  send: (type: string, payload: Record<string, unknown>) => Promise<boolean>;
};

export function resendPendingOnReconnect(
  ws: WsLike,
  userId: string,
  opts?: {
    onDropNonce?: (key: string, clientNonce: string) => void;
  },
): void {
  staleAllMessagePageCaches();
  scrubStalePendingInAllCaches();
  const now = Date.now();
  const young = collectYoungPendingFromAllCaches(now).filter(({ message: m }) => {
    const senderId =
      typeof m.sender === "string" ? m.sender : m.sender?._id;
    return senderId === userId;
  });
  for (const { key, message: m } of young) {
    if (!m.clientNonce) continue;
    const quotedId =
      typeof m.quotedMessage === "string"
        ? m.quotedMessage
        : m.quotedMessage?._id;
    const wire: Record<string, unknown> = {
      sender: userId,
      content: m.content ? wrapOutgoingContent(m.content) : m.content ?? "",
      messageType: m.messageType ?? "TEXT",
      clientNonce: m.clientNonce,
      ...(m.fileUrl
        ? {
            fileUrl: m.fileUrl,
            fileName: m.fileName,
            fileType: m.fileType,
            ...(m.durationMs != null ? { durationMs: m.durationMs } : {}),
          }
        : {}),
      ...(quotedId ? { quotedMessage: quotedId } : {}),
    };
    const isDm = key.startsWith("dm:");
    const peerOrChannelId = key.slice(key.indexOf(":") + 1);
    void (async () => {

      try {
        if (isDm) {
          await ws.send(WsType.SEND_MESSAGE, {
            ...wire,
            recipient: peerOrChannelId,
          });
        } else {
          await ws.send(WsType.SEND_CHANNEL_MESSAGE, {
            ...wire,
            channelId: peerOrChannelId,
          });
        }
      } catch {
        if (m.clientNonce) {
          dropPendingNonceFromCache(key, m.clientNonce);
          opts?.onDropNonce?.(key, m.clientNonce);
        }
      }
    })();
  }
}

export function isPendingAged(m: Message, now = Date.now()): boolean {
  if (!m.pending) return false;
  const created = Date.parse(m.timestamp);
  if (!Number.isFinite(created)) return true;
  return now - created >= PENDING_MESSAGE_TTL_MS;
}
