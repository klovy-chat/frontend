// MessageCache.tsx
// Mostek cache stron czatu w powłoce (przeżywa wyjście z Chat).
// Zakres:
//  - reconnect resend, drop starych pending
//  - montuje magazyn stron w App (przeżywa wyjście z Chat)
// Logika magazynu jest w messageCache.ts — tu tylko lifecycle.
// Przy zmianach: messageCache.ts, resend.ts, App.tsx.

import { useEffect, useRef } from "react";
import { useAuth } from "../../context/AuthContext";
import { useWebSocket, useWebSocketConnected } from "../../context/WebSocketContext";
import { WsType } from "../../api/protocol";
import {
  appendCachedMessage,
  channelCacheKey,
  dmCacheKey,
  getMessagePageCache,
  mapCachedMessagesEverywhere,
  patchCachedMessageEverywhere,
  patchCachedSenderEverywhere,
  patchMessagePageCacheLive,
  removeCachedMessageEverywhere,
  removeMessagePageCache,
  scrubStalePendingInAllCaches,
} from "../../utils/chat/messageCache";
import { resendPendingOnReconnect } from "../../utils/chat/resend";
import { useProfileSync } from "../../hooks/useProfileSync";
import { normalizeMessage } from "../../utils/chat/messages";
import { mergeMessagePatch } from "../../utils/chat/merge";
import { normalizeReactions } from "../../utils/chat/reactions";
import {
  unwrapIncomingMessage,
  unwrapIncomingMessages,
} from "../../crypto/encrypt";
import type { Message, MessageReactions } from "../../types";

export function MessageCache() {
  const ws = useWebSocket();
  const wsConnected = useWebSocketConnected();
  const { user } = useAuth();
  const userId = user?.id;
  const wasConnectedRef = useRef(wsConnected);

  useEffect(() => {
    const was = wasConnectedRef.current;
    wasConnectedRef.current = wsConnected;
    if (!ws || !userId || !wsConnected || was) return;
    resendPendingOnReconnect(ws, userId);
  }, [ws, wsConnected, userId]);

  useEffect(() => {
    const id = window.setInterval(() => scrubStalePendingInAllCaches(), 5_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!ws || !userId) return;

    const prepare = (msg: Message) =>
      unwrapIncomingMessages([normalizeMessage(msg)])[0];

    const onDm = (msg: Message) => {
      const next = prepare(msg);
      if (!next) return;
      const senderId =
        typeof next.sender === "object"
          ? next.sender._id ?? next.sender.id
          : next.sender;
      const recipientId =
        typeof next.recipient === "object"
          ? next.recipient?._id ?? next.recipient?.id
          : next.recipient;
      const other =
        senderId === userId
          ? recipientId
          : recipientId === userId
            ? senderId
            : null;
      if (other) {
        appendCachedMessage(dmCacheKey(other), next, {
          currentUserId: userId,
        });
      }
    };

    const onChannel = (msg: Message & { channelId?: string }) => {
      const next = prepare(msg);
      if (!next) return;
      const chId = msg.channelId ?? next.channelId ?? next.channel;
      if (typeof chId === "string" && chId) {
        appendCachedMessage(channelCacheKey(chId), next, {
          currentUserId: userId,
        });
      }
    };

    const onEdited = (msg: Message) => {
      const next = unwrapIncomingMessage(normalizeMessage(msg));
      mapCachedMessagesEverywhere((m: Message) => {
        const matches =
          m._id === next._id ||
          (Boolean(m.clientNonce) && m.clientNonce === next.clientNonce);
        const base = matches ? mergeMessagePatch(m, next) : m;
        const q = base.quotedMessage;
        if (q && typeof q === "object" && q._id === next._id) {
          return { ...base, quotedMessage: mergeMessagePatch(q, next) };
        }
        return base;
      });
    };

    const onDeleted = (data: { _id: string }) => {
      removeCachedMessageEverywhere(data._id);
    };

    const onReaction = (data: {
      messageId: string;
      reactions: MessageReactions;
    }) => {
      patchCachedMessageEverywhere(data.messageId, (m: Message) => ({
        ...m,
        reactions: normalizeReactions(data.reactions),
      }));
    };

    const onMessageRead = (data: {
      messageId?: string;
      _id?: string;
      read?: boolean;
    }) => {
      const id = data.messageId ?? data._id;
      if (!id) return;
      patchCachedMessageEverywhere(id, (m: Message) => ({
        ...m,
        read: data.read ?? true,
      }));
    };

    const onMessagesRead = (data: {
      messageIds?: string[];
      read?: boolean;
      conversationRead?: boolean;
      readerId?: string;
    }) => {
      const read = data.read ?? true;
      if (data.conversationRead && data.readerId) {
        const key = dmCacheKey(data.readerId);
        const cached = getMessagePageCache(key);
        if (!cached) return;
        const messages = cached.messages.map((m) => {
          const senderId =
            typeof m.sender === "object" ? m.sender._id ?? m.sender.id : m.sender;
          return senderId === userId ? { ...m, read } : m;
        });
        patchMessagePageCacheLive(key, messages, cached.hasMore);
        return;
      }
      const ids = data.messageIds ?? [];
      for (const id of ids) {
        patchCachedMessageEverywhere(id, (m: Message) => ({
          ...m,
          read,
        }));
      }
    };

    const dropChannelCache = (e: { channelId?: string }) => {
      if (e.channelId) removeMessagePageCache(channelCacheKey(e.channelId));
    };
    const dropChannelIfSelf = (e: { channelId?: string; userId?: string }) => {
      if (e.channelId && e.userId && e.userId === userId) {
        removeMessagePageCache(channelCacheKey(e.channelId));
      }
    };
    const dropDmCache = (e: { contactId?: string; userId?: string }) => {
      const peer = e.contactId ?? e.userId;
      if (peer) removeMessagePageCache(dmCacheKey(peer));
    };

    const unsubs = [
      ws.subscribe(WsType.RECEIVE_MESSAGE, onDm),
      ws.subscribe(WsType.RECEIVE_CHANNEL_MESSAGE, onChannel),
      ws.subscribe(WsType.MESSAGE_EDITED, onEdited),
      ws.subscribe(WsType.MESSAGE_DELETED, onDeleted),
      ws.subscribe(WsType.MESSAGE_REACTION, onReaction),
      ws.subscribe(WsType.MESSAGE_READ, onMessageRead),
      ws.subscribe(WsType.MESSAGES_READ, onMessagesRead),
      ws.subscribe(WsType.CHANNEL_DELETED, dropChannelCache),
      ws.subscribe(WsType.CHANNEL_LEFT, dropChannelCache),
      ws.subscribe(WsType.CHANNEL_MEMBER_LEFT, dropChannelIfSelf),
      ws.subscribe(WsType.CONVERSATION_DELETED, dropDmCache),
      ws.subscribe(WsType.FRIENDSHIP_REMOVED, dropDmCache),
    ];
    return () => unsubs.forEach((u) => u());
  }, [ws, userId]);

  useProfileSync(ws, {
    onInfo: (data) => {
      const patch: { username?: string; displayName?: string | null } = {};
      if (data.username !== undefined) patch.username = data.username ?? undefined;
      if (data.displayName !== undefined) patch.displayName = data.displayName;
      patchCachedSenderEverywhere(data.userId, patch);
    },
    onImage: (data) => {
      patchCachedSenderEverywhere(data.userId, { image: data.image });
    },
  });

  return null;
}
