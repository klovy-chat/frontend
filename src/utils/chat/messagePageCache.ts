import type { ChatTarget, Message, MessageUser } from "../../types";
import { mergeMessagePatch } from "./mergeMessage";
import { getMessagePreview } from "./messages";

export type MessagePageCacheEntry = {
  messages: Message[];
  hasMore: boolean;
  /** Only HTTP / full writes bump this — WS patches must preserve it. */
  fetchedAt: number;
};

/** Skip HTTP revalidate when cache is fresher than this. */
export const MESSAGE_CACHE_FRESH_MS = 20_000;
/** Drop optimistic rows that never got a server ack. */
export const PENDING_MESSAGE_TTL_MS = 45_000;

const messagePageCache = new Map<string, MessagePageCacheEntry>();

function senderIdOf(message: Message): string | undefined {
  const sender = message.sender;
  if (!sender) return undefined;
  return typeof sender === "string" ? sender : sender._id ?? sender.id;
}

function contentOrFileMatch(pending: Message, server: Message): boolean {
  const pType = pending.messageType ?? "TEXT";
  const sType = server.messageType ?? "TEXT";
  if (pType !== sType) return false;
  // Prefer file identity — content-only match is too collision-prone for rapid sends.
  if (pending.fileUrl && server.fileUrl && pending.fileUrl === server.fileUrl) {
    return true;
  }
  if (
    pending.fileName &&
    server.fileName &&
    pending.fileName === server.fileName &&
    pending.fileUrl &&
    server.fileUrl
  ) {
    return true;
  }
  if ((pType === "TEXT" || !pending.fileUrl) && pending.content === server.content) {
    const pt = Date.parse(pending.timestamp);
    const st = Date.parse(server.timestamp);
    // Only match when timestamps are within 2 minutes (reconnect/HTTP gap).
    if (Number.isFinite(pt) && Number.isFinite(st) && Math.abs(pt - st) <= 120_000) {
      return true;
    }
  }
  return false;
}

function pendingMatchesServer(pending: Message, server: Message): boolean {
  // Prefer nonce when both sides have it (authoritative after server persist).
  if (pending.clientNonce && server.clientNonce) {
    return pending.clientNonce === server.clientNonce;
  }
  // HTTP / legacy rows may omit nonce — fall back to content/file for same sender.
  if (pending.clientNonce && !server.clientNonce) {
    return contentOrFileMatch(pending, server);
  }
  if (!pending.clientNonce) {
    return contentOrFileMatch(pending, server);
  }
  return false;
}

export function findPendingReplaceIndex(
  messages: Message[],
  server: Message,
  currentUserId: string,
): number {
  if (senderIdOf(server) !== currentUserId) return -1;
  const candidates = messages
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.pending && senderIdOf(m) === currentUserId)
    .filter(({ m }) => pendingMatchesServer(m, server));
  // Ambiguous content match (2+ identical pendings) — wait for nonce.
  if (candidates.length !== 1) return -1;
  return candidates[0].i;
}

export function chatCacheKey(target: ChatTarget): string {
  return target.type === "dm"
    ? `dm:${target.contact._id}`
    : `ch:${target.channel._id}`;
}

export function dmCacheKey(contactId: string): string {
  return `dm:${contactId}`;
}

export function channelCacheKey(channelId: string): string {
  return `ch:${channelId}`;
}

export function getMessagePageCache(
  key: string,
): MessagePageCacheEntry | undefined {
  return messagePageCache.get(key);
}

export function setMessagePageCache(
  key: string,
  messages: Message[],
  hasMore: boolean,
) {
  messagePageCache.set(key, {
    messages,
    hasMore,
    fetchedAt: Date.now(),
  });
}

export function writeMessagePageCache(
  key: string,
  messages: Message[],
  hasMore?: boolean,
) {
  const cached = messagePageCache.get(key);
  messagePageCache.set(key, {
    messages,
    hasMore: hasMore ?? cached?.hasMore ?? false,
    fetchedAt: Date.now(),
  });
}

/** Live WS / optimistic patch — preserves fetchedAt so reconnect stale wins. */
export function patchMessagePageCacheLive(
  key: string,
  messages: Message[],
  hasMore?: boolean,
) {
  const cached = messagePageCache.get(key);
  if (!cached) {
    messagePageCache.set(key, {
      messages,
      hasMore: hasMore ?? false,
      fetchedAt: Date.now() - MESSAGE_CACHE_FRESH_MS - 1,
    });
    return;
  }
  messagePageCache.set(key, {
    ...cached,
    messages,
    hasMore: hasMore ?? cached.hasMore,
    fetchedAt: cached.fetchedAt,
  });
}

export function isMessageCacheFresh(entry: MessagePageCacheEntry): boolean {
  return Date.now() - entry.fetchedAt < MESSAGE_CACHE_FRESH_MS;
}

export function scrubStalePendingInAllCaches(now = Date.now()) {
  for (const [key, entry] of messagePageCache) {
    const messages = entry.messages.filter((m) => {
      if (!m.pending) return true;
      const age = now - new Date(m.timestamp).getTime();
      return age < PENDING_MESSAGE_TTL_MS;
    });
    if (messages.length !== entry.messages.length) {
      patchLive(key, entry, messages);
    }
  }
}

/** Young optimistic pendings across all chats (for reconnect resend). */
export function collectYoungPendingFromAllCaches(
  now = Date.now(),
): Array<{ key: string; message: Message }> {
  const out: Array<{ key: string; message: Message }> = [];
  for (const [key, entry] of messagePageCache) {
    for (const m of entry.messages) {
      if (!m.pending || !m.clientNonce) continue;
      const created = Date.parse(m.timestamp);
      if (!Number.isFinite(created)) continue;
      if (now - created >= PENDING_MESSAGE_TTL_MS) continue;
      out.push({ key, message: m });
    }
  }
  return out;
}

type PendingDropListener = (key: string, clientNonce: string) => void;
const pendingDropListeners = new Set<PendingDropListener>();

export function subscribePendingDrop(listener: PendingDropListener): () => void {
  pendingDropListeners.add(listener);
  return () => {
    pendingDropListeners.delete(listener);
  };
}

export function dropPendingNonceFromCache(key: string, clientNonce: string) {
  const cached = messagePageCache.get(key);
  if (cached) {
    patchLive(
      key,
      cached,
      cached.messages.filter((m) => m.clientNonce !== clientNonce),
    );
  }
  for (const listener of pendingDropListeners) {
    try {
      listener(key, clientNonce);
    } catch {
      /* ignore */
    }
  }
}

/** Ensure a cache row exists and append an optimistic pending (e.g. send after chat switch). */
export function ensureOptimisticInCache(key: string, message: Message) {
  const cached = messagePageCache.get(key);
  if (!cached) {
    messagePageCache.set(key, {
      messages: [message],
      hasMore: false,
      fetchedAt: 0,
    });
    return;
  }
  if (
    message.clientNonce &&
    cached.messages.some((m) => m.clientNonce === message.clientNonce)
  ) {
    return;
  }
  patchLive(key, cached, [...cached.messages, message]);
}

/** Force next open/load to hit HTTP (e.g. after WS reconnect). */
export function staleAllMessagePageCaches() {
  const now = Date.now();
  for (const [key, entry] of messagePageCache) {
    messagePageCache.set(key, {
      ...entry,
      fetchedAt: now - MESSAGE_CACHE_FRESH_MS - 1,
    });
  }
}

/** Live WS patch — update messages but keep fetchedAt so reconnect stale wins. */
function patchLive(
  key: string,
  entry: MessagePageCacheEntry,
  messages: Message[],
) {
  messagePageCache.set(key, {
    ...entry,
    messages,
    fetchedAt: entry.fetchedAt,
  });
}

export function removeMessagePageCache(key: string) {
  messagePageCache.delete(key);
}

/** Drop all chat message caches (logout / account switch). */
export function clearAllMessagePageCaches() {
  messagePageCache.clear();
}

export function appendCachedMessage(
  key: string,
  message: Message,
  opts?: { currentUserId?: string },
) {
  const cached = messagePageCache.get(key);
  if (!cached) return;

  if (cached.messages.some((m) => m._id === message._id)) {
    const userId = opts?.currentUserId;
    patchLive(
      key,
      cached,
      cached.messages
        .filter((m) => {
          if (!m.pending || !userId) return true;
          if (m._id === message._id) return true;
          return findPendingReplaceIndex([m], message, userId) !== 0;
        })
        .map((m) =>
          m._id === message._id
            ? { ...mergeMessagePatch(m, message), pending: false }
            : m,
        ),
    );
    return;
  }

  let messages = cached.messages;
  if (opts?.currentUserId) {
    const pendingIdx = findPendingReplaceIndex(
      messages,
      message,
      opts.currentUserId,
    );
    if (pendingIdx >= 0) {
      messages = messages.slice();
      messages[pendingIdx] = {
        ...mergeMessagePatch(messages[pendingIdx], message),
        pending: false,
      };
      patchLive(key, cached, messages);
      return;
    }
  }

  patchLive(key, cached, [...messages, message]);
}

export function patchCachedMessage(
  key: string,
  messageId: string,
  patch: (m: Message) => Message,
) {
  const cached = messagePageCache.get(key);
  if (!cached) return;
  if (!cached.messages.some((m) => m._id === messageId)) return;
  patchLive(
    key,
    cached,
    cached.messages.map((m) => (m._id === messageId ? patch(m) : m)),
  );
}

export function removeCachedMessage(key: string, messageId: string) {
  const cached = messagePageCache.get(key);
  if (!cached) return;
  patchLive(
    key,
    cached,
    cached.messages.filter((m) => m._id !== messageId),
  );
}

export function patchCachedMessageEverywhere(
  messageId: string,
  patch: (m: Message) => Message,
) {
  for (const [key, entry] of messagePageCache) {
    if (!entry.messages.some((m) => m._id === messageId)) continue;
    patchLive(
      key,
      entry,
      entry.messages.map((m) => (m._id === messageId ? patch(m) : m)),
    );
  }
}

/** Map every cached message (used for quote edit/delete side-effects). */
export function mapCachedMessagesEverywhere(map: (m: Message) => Message) {
  for (const [key, entry] of messagePageCache) {
    let changed = false;
    const messages = entry.messages.map((m) => {
      const next = map(m);
      if (next !== m) changed = true;
      return next;
    });
    if (!changed) continue;
    patchLive(key, entry, messages);
  }
}

export function removeCachedMessageEverywhere(messageId: string) {
  for (const [key, entry] of messagePageCache) {
    let changed = false;
    const messages: Message[] = [];
    for (const m of entry.messages) {
      if (m._id === messageId) {
        changed = true;
        continue;
      }
      const q = m.quotedMessage;
      if (q && typeof q === "object" && q._id === messageId) {
        changed = true;
        messages.push({ ...m, quotedMessage: { ...q, deleted: true } });
      } else {
        messages.push(m);
      }
    }
    if (!changed) continue;
    patchLive(key, entry, messages);
  }
}

export function patchCachedSenderEverywhere(
  userId: string,
  patch: Partial<MessageUser>,
) {
  for (const [key, entry] of messagePageCache) {
    let changed = false;
    const messages = entry.messages.map((m) => {
      const sender = m.sender;
      if (typeof sender !== "object" || !sender) return m;
      const sid = sender._id ?? sender.id;
      if (sid !== userId) return m;
      changed = true;
      return { ...m, sender: { ...sender, ...patch } };
    });
    if (!changed) continue;
    patchLive(key, entry, messages);
  }
}

/** Last non-pending tip for list preview backfill after delete. */
export function getCachedTipPreview(
  key: string,
  opts?: { excludeId?: string },
): {
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageId?: string;
} | null {
  const cached = messagePageCache.get(key);
  if (!cached || cached.messages.length === 0) return null;
  const excludeId = opts?.excludeId;
  for (let i = cached.messages.length - 1; i >= 0; i--) {
    const m = cached.messages[i];
    if (m.pending || m.deleted) continue;
    if (excludeId && m._id === excludeId) continue;
    return {
      lastMessageId: m._id,
      lastMessageTime: m.timestamp,
      lastMessage: getMessagePreview(m),
    };
  }
  return null;
}
