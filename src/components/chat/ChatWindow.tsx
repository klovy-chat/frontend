// ChatWindow.tsx
// Otwarta rozmowa: historia, wysyłka, edit, react, mark-read, przyjaźń.
// Zakres:
//  - cache HTTP+WS
//  - optimistic pending
//  - throttled mark-read kanału
// Nie bierz pending mark-read tutaj przy visibility — UnreadSync jest właścicielem flush.
// Przy zmianach: MessageInput.tsx, messageCache.ts, markRead.ts, UnreadSync.tsx.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import {
  getMessages,
  uploadFile,
  pinMessageHttp,
  unpinMessageHttp,
} from "../../api/messages";
import { getChannelMessages, getChannelDetails } from "../../api/channels";
import { checkFriendship } from "../../api/friends";
import { toggleContactBlock } from "../../api/contacts";
import { useAuth } from "../../context/AuthContext";
import { useWebSocket, useWebSocketConnected } from "../../context/WebSocketContext";
import { WsType } from "../../api/protocol";
import { useCall, type CallPeer } from "../../context/CallContext";
import { userLabel, availabilityStatusLabel } from "../../utils/user/format";
import { stripFormatting } from "../../utils/chat/format";
import {
  isVoiceAttachment,
  resolveUploadMessageType,
  uploadUsesFileNameAsContent,
} from "../../utils/media/attachments";
import {
  extractExternalMediaLinks,
  resolveSingleExternalMediaSend,
} from "../../utils/media/mediaLinks";
import { isAllowedGifMediaUrl } from "../../utils/media/allowedMedia";
import { useProfileSync } from "../../hooks/useProfileSync";
import { presenceColor } from "../../utils/user/presence";
import {
  usePresenceSeed,
  useUserPresence,
} from "../../context/PresenceContext";
import {
  chatCacheKey,
  findPendingReplaceIndex,
  getMessagePageCache,
  isMessageCacheFresh,
  PENDING_MESSAGE_TTL_MS,
  setMessagePageCache,
  dropPendingNonceFromCache,
  ensureOptimisticInCache,
  patchMessagePageCacheLive as patchCacheLive,
  patchCachedMessageEverywhere,
  subscribePendingDrop,
} from "../../utils/chat/messageCache";
import { isPendingAged } from "../../utils/chat/resend";
import {
  publishSidebarTipFromMessage,
  publishSidebarTipRevert,
} from "../../utils/chat/preview";
import {
  getPendingMarkReadGeneration,
  queuePendingMarkRead,
  queuePendingMarkReadSync,
  trackMarkReadInFlight,
} from "../../utils/sync/markRead";
import {
  getCachedFriendship,
  getFriendshipEpoch,
  setCachedFriendship,
  subscribeFriendshipInvalidation,
} from "../../utils/chat/friendsCache";
import { mergeMessagePatch, mergePreferReactions } from "../../utils/chat/merge";
import {
  normalizeMessage,
} from "../../utils/chat/messages";
import { MESSAGE_PAGE_SIZE } from "../../constants/messages";
import {
  normalizeReactions,
  toggleReactionLocal,
} from "../../utils/chat/reactions";
import { Avatar } from "../common/Avatar";
import { OtherProfile } from "../profile/OtherProfile";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { DeleteMessage } from "./DeleteMessage";
import { Lightbox, type LightboxItem } from "./Lightbox";
import { ChatTools } from "./ChatTools";
import type {
  ChatTarget,
  Contact,
  MentionCandidate,
  Message,
  MessageReactions,
  MessageUser,
} from "../../types";
import {
  wrapOutgoingContent,
  unwrapIncomingMessage,
  unwrapIncomingMessages,
} from "../../crypto/encrypt";

type ToolsPanelMode = "pinned" | "search" | null;

function writeMessagePageCache(
  target: ChatTarget,
  messages: Message[],
  hasMore?: boolean,
) {

  patchCacheLive(chatCacheKey(target), messages, hasMore);
}

function mergeHttpWithLive(
  http: Message[],
  live: Message[],
  currentUserId: string,
): Message[] {
  const map = new Map<string, Message>();
  for (const m of http) map.set(m._id, m);
  for (const m of live) {
    if (m.pending) {
      const serverList = [...map.values(), ...live.filter((x) => !x.pending)];
      const acked = serverList.some(
        (x) => findPendingReplaceIndex([m], x, currentUserId) === 0,
      );
      if (acked) continue;
      map.set(m._id, m);
      continue;
    }
    const cur = map.get(m._id);
    if (!cur) {
      map.set(m._id, m);
      continue;
    }
    map.set(m._id, {
      ...cur,
      ...m,

      content: m.edited || cur.edited
        ? m.edited
          ? m.content
          : cur.content
        : m.content ?? cur.content,
      edited: Boolean(cur.edited || m.edited),
      editedAt: m.editedAt ?? cur.editedAt,
      read: Boolean(cur.read || m.read),

      reactions: mergePreferReactions(m.reactions, cur.reactions),
      pending: false,
      pinned: m.pinned ?? cur.pinned,
      pinnedAt: m.pinnedAt ?? cur.pinnedAt,
    });
  }
  return Array.from(map.values()).sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    if (ta !== tb) return ta - tb;
    return a._id.localeCompare(b._id);
  });
}

function messageSenderId(msg: Message): string | undefined {
  const sender = msg.sender;
  if (!sender) return undefined;
  return typeof sender === "string" ? sender : sender._id ?? sender.id;
}

function replacePendingWithServer(prev: Message[], next: Message, userId: string): Message[] {

  const withoutMatchedPending = prev.filter((m) => {
    if (!m.pending || messageSenderId(m) !== userId) return true;
    if (m._id === next._id) return true;
    return findPendingReplaceIndex([m], next, userId) !== 0;
  });
  if (withoutMatchedPending.some((m) => m._id === next._id)) {
    return withoutMatchedPending.map((m) =>
      m._id === next._id
        ? { ...mergeMessagePatch(m, next), pending: false }
        : m,
    );
  }
  if (messageSenderId(next) === userId) {
    const pendingIdx = findPendingReplaceIndex(withoutMatchedPending, next, userId);
    if (pendingIdx >= 0) {
      const copy = withoutMatchedPending.slice();
      copy[pendingIdx] = {
        ...mergeMessagePatch(copy[pendingIdx], next),
        pending: false,
      };
      return copy;
    }
  }
  return [...withoutMatchedPending, next];
}

function patchMessageSender(
  message: Message,
  userId: string,
  patch: Partial<MessageUser>,
): Message {
  const { sender } = message;
  if (typeof sender === "string" || !sender) return message;
  const senderId = sender._id ?? sender.id;
  if (senderId !== userId) return message;
  return { ...message, sender: { ...sender, ...patch } };
}

function toCallPeer(contact: Contact): CallPeer {
  return {
    _id: contact._id,
    username: contact.username,
    displayName: contact.displayName,
    image: contact.image,
    color: contact.color,
  };
}

interface ChatWindowProps {
  target: ChatTarget | null;
  onClose?: () => void;
  onOpenChannelSettings?: (channel: import("../../types").Channel) => void;
  onRemoveContact?: (contact: Contact) => void;
}

const C = {
  bgPanel:      "var(--bg-panel)",
  border:       "var(--border)",
  textMuted:    "var(--text-muted)",
};

function IconBtn({
  onClick,
  title,
  active = false,
  danger = false,
  children,
}: {
  onClick?: () => void;
  title?: string;
  active?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  const className = [
    "chat-header__toolbar-btn",
    active && "chat-header__toolbar-btn--active",
    danger && "chat-header__toolbar-btn--danger",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button type="button" title={title} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

export function ChatWindow({
  target,
  onClose,
  onOpenChannelSettings,
  onRemoveContact,
}: ChatWindowProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const ws = useWebSocket();
  const wsConnected = useWebSocketConnected();
  const {
    startCall,
    state: callState,
    toggleChannelVoice,
    isInChannelVoice,
    isChannelVoiceActive,
    requestChannelVoiceState,
  } = useCall();
  const seedPresence = usePresenceSeed();
  const dmPresence = useUserPresence(
    target?.type === "dm" ? target.contact._id : undefined,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const typingClearTimeout = useRef<ReturnType<typeof setTimeout>>();
  const pendingSendKeysRef = useRef<Map<string, string>>(new Map());
  const lastSendChatKeyRef = useRef<string | null>(null);
  const activeChatKeyRef = useRef<string | null>(null);
  const lastChannelMarkReadAtRef = useRef(0);
  const channelMarkReadTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    messageId: string;
    preview: string;
  } | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const isFriendRef = useRef(isFriend);
  isFriendRef.current = isFriend;
  const isBlockedByMeRef = useRef(isBlockedByMe);
  isBlockedByMeRef.current = isBlockedByMe;
  const isBlockedByOtherRef = useRef(isBlockedByOther);
  isBlockedByOtherRef.current = isBlockedByOther;
  const [friendshipLoading, setFriendshipLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const [toolsPanel, setToolsPanel] = useState<ToolsPanelMode>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const loadGenRef = useRef(0);
  const [channelRoster, setChannelRoster] = useState<Contact[]>([]);
  const friendshipEpoch = useSyncExternalStore(
    subscribeFriendshipInvalidation,
    getFriendshipEpoch,
    getFriendshipEpoch,
  );
  activeChatKeyRef.current = target ? chatCacheKey(target) : null;
  const targetRef = useRef(target);
  targetRef.current = target;
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const markSessionGenRef = useRef(getPendingMarkReadGeneration());
  useEffect(() => {
    if (user?.id) {
      markSessionGenRef.current = getPendingMarkReadGeneration();
    }
  }, [user?.id]);
  const wsRef = useRef(ws);
  wsRef.current = ws;

  const imageLightboxItems = useMemo<LightboxItem[]>(() => {
    const items: LightboxItem[] = [];

    for (const message of messages) {
      if (message.messageType === "IMAGE" && message.fileUrl) {
        items.push({
          url: message.fileUrl,
          fileName: message.fileName ?? t("messages.image"),
          messageId: message._id,
        });
        continue;
      }

      if (!message.content) continue;
      for (const media of extractExternalMediaLinks(message.content)) {
        items.push({
          url: media.url,
          fileName: media.fileName,
          messageId: `${message._id}:${media.url}`,
        });
      }
    }

    return items;
  }, [messages, t]);

  const currentUserId = user?.id ?? "";
  const isDmBlocked = isBlockedByMe || isBlockedByOther;
  const canSendDm = target?.type !== "dm" || (isFriend && !isDmBlocked);
  const canReact =
    Boolean(target && currentUserId) &&
    (target?.type === "channel" || canSendDm);
  const canReply = canReact;
  const showReadReceipt = target?.type === "dm" && canSendDm;

  const canPin =
    target?.type === "channel"
      ? String(target.channel.admin._id) === currentUserId
      : target?.type === "dm"
        ? canSendDm
        : false;

  const isChannelChatLocked =
    target?.type === "channel" &&
    Boolean(target.channel.chatLocked) &&
    String(target.channel.admin._id) !== currentUserId;

  const isChannelMuted =
    target?.type === "channel" &&
    Boolean(target.channel.isMutedHere) &&
    String(target.channel.admin._id) !== currentUserId;

  const canSendChannel = target?.type !== "channel" || (!isChannelChatLocked && !isChannelMuted);

  const toMentionCandidate = (c: Contact): MentionCandidate | null =>
    c.username
      ? {
          id: c._id,
          username: c.username,
          displayName: c.displayName,
          image: c.image,
          color: c.color,
        }
      : null;

  const mentionCandidates = useMemo<MentionCandidate[]>(() => {
    if (!target) return [];
    if (target.type === "dm") {
      const candidate = toMentionCandidate(target.contact);
      return candidate ? [candidate] : [];
    }
    const seen = new Set<string>();
    const out: MentionCandidate[] = [];
    const add = (c?: Contact | null) => {
      if (!c) return;
      const candidate = toMentionCandidate(c);
      if (!candidate || seen.has(candidate.id) || candidate.id === currentUserId) {
        return;
      }
      seen.add(candidate.id);
      out.push(candidate);
    };
    const members =
      target.channel.members.length > 0 ? target.channel.members : channelRoster;
    members.forEach(add);
    add(target.channel.admin);
    return out;
  }, [target, currentUserId, channelRoster]);

  useEffect(() => {
    if (target?.type !== "channel") {
      setChannelRoster([]);
      return;
    }
    if (target.channel.members.length > 0) {
      setChannelRoster(target.channel.members);
    }
  }, [
    target?.type === "channel" ? target.channel._id : null,
    target?.type === "channel"
      ? target.channel.members.map((m) => m._id).join(",")
      : "",
  ]);

  useEffect(() => {
    if (target?.type !== "channel") return;
    const channelId = target.channel._id;

    if (target.channel.members.length > 0) {
      setChannelRoster(target.channel.members);
      return;
    }
    let cancelled = false;
    getChannelDetails(channelId)
      .then((res) => {
        if (cancelled) return;
        setChannelRoster(res.channel.members ?? []);
      })
      .catch(() => {

      });
    return () => {
      cancelled = true;
    };
  }, [
    target?.type === "channel" ? target.channel._id : null,
    target?.type === "channel" ? target.channel.members.length : 0,
    target?.type === "channel"
      ? target.channel.members.map((m) => m._id).join(",")
      : "",
  ]);

  const allowMentionEveryone = target?.type === "channel";

  const prepareForDisplay = useCallback(
    (list: Message[]) => {
      const normalized = list.map(normalizeMessage);
      return unwrapIncomingMessages(normalized);
    },
    [],
  );

  const loadMessages = useCallback(async () => {
    if (!target || !currentUserId) return;
    const gen = ++loadGenRef.current;
    const cacheKey = chatCacheKey(target);
    const cached = getMessagePageCache(cacheKey);
    if (cached) {
      setMessages(cached.messages);
      setHasMore(cached.hasMore);
      setLoading(false);
      if (isMessageCacheFresh(cached)) return;
    } else {
      setLoading(true);
    }
    try {
      if (target.type === "dm") {
        try {
          const { messages: list, hasMore: more } = await getMessages(
            target.contact._id,
            { limit: MESSAGE_PAGE_SIZE },
          );
          if (gen !== loadGenRef.current) return;
          const prepared = prepareForDisplay(list);
          const hasMorePage = Boolean(more);
          setMessages((prev) => {
            const merged = mergeHttpWithLive(prepared, prev, currentUserId);
            setMessagePageCache(cacheKey, merged, hasMorePage);
            return merged;
          });
          setHasMore(hasMorePage);
        } catch {
          if (gen !== loadGenRef.current) return;
          if (!cached) {
            setMessages([]);
            setHasMore(false);
          }
        }
      } else {
        try {
          const { messages: list, hasMore: more } = await getChannelMessages(
            target.channel._id,
            { limit: MESSAGE_PAGE_SIZE },
          );
          if (gen !== loadGenRef.current) return;
          const prepared = prepareForDisplay(list);
          const hasMorePage = Boolean(more);
          setMessages((prev) => {
            const merged = mergeHttpWithLive(prepared, prev, currentUserId);
            setMessagePageCache(cacheKey, merged, hasMorePage);
            return merged;
          });
          setHasMore(hasMorePage);
        } catch {
          if (gen !== loadGenRef.current) return;
          if (!cached) {
            setMessages([]);
            setHasMore(false);
          }
        }
      }
    } finally {
      if (gen === loadGenRef.current) setLoading(false);
    }
  }, [target, currentUserId, prepareForDisplay]);

  const loadOlderMessages = useCallback(async () => {
    if (!target || !currentUserId || loadingOlder || !hasMore) return;
    const gen = loadGenRef.current;
    const oldest = messagesRef.current[0]?._id;
    if (!oldest) return;
    const targetSnapshot = target;
    setLoadingOlder(true);
    try {
      const page =
        targetSnapshot.type === "dm"
          ? await getMessages(targetSnapshot.contact._id, {
              before: oldest,
              limit: MESSAGE_PAGE_SIZE,
            })
          : await getChannelMessages(targetSnapshot.channel._id, {
              before: oldest,
              limit: MESSAGE_PAGE_SIZE,
            });
      if (gen !== loadGenRef.current) return;
      const older = prepareForDisplay(page.messages);
      const hasMorePage = Boolean(page.hasMore);
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m._id));
        const merged = older.filter((m) => !existing.has(m._id));
        const next = merged.length > 0 ? [...merged, ...prev] : prev;
        writeMessagePageCache(targetSnapshot, next, hasMorePage);
        return next;
      });
      setHasMore(hasMorePage);
    } catch {

    } finally {
      if (gen === loadGenRef.current) setLoadingOlder(false);
    }
  }, [target, currentUserId, hasMore, loadingOlder, prepareForDisplay]);

  const targetKey = target ? chatCacheKey(target) : null;
  const loadMessagesRef = useRef(loadMessages);
  loadMessagesRef.current = loadMessages;

  useEffect(() => {
    const cached = targetKey ? getMessagePageCache(targetKey) : undefined;
    if (cached) {
      setMessages(cached.messages);
      setHasMore(cached.hasMore);
      setLoading(false);
    } else {
      setMessages([]);
      setHasMore(false);
    }
    setLoadingOlder(false);
    setTypingUserId(null);
    if (typingClearTimeout.current) {
      clearTimeout(typingClearTimeout.current);
      typingClearTimeout.current = undefined;
    }
    setDmError(null);
    if (target?.type === "dm") seedPresence([target.contact]);
    setToolsPanel(null);
    setHighlightMessageId(null);
    setEditingMessage(null);
    setReplyingTo(null);
    setDeleteConfirm(null);
    void loadMessagesRef.current();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, seedPresence]);

  useEffect(() => {
    if (target?.type === "dm") seedPresence([target.contact]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    targetKey,
    target?.type === "dm" ? target.contact._id : null,
    seedPresence,
  ]);

  useEffect(() => {
    if (!dmError) return;
    if (target?.type === "dm" && !canSendDm) return;
    const id = window.setTimeout(() => setDmError(null), 5_000);
    return () => window.clearTimeout(id);
  }, [dmError, target, canSendDm]);

  const wsWasConnectedRef = useRef(wsConnected);
  useEffect(() => {
    const was = wsWasConnectedRef.current;
    wsWasConnectedRef.current = wsConnected;
    if (!wsConnected || was) return;

    const now = Date.now();
    setMessages((prev) => {
      const dropped = prev.filter((m) => isPendingAged(m, now));
      if (dropped.length === 0) return prev;
      for (const m of dropped) {
        if (m.clientNonce) pendingSendKeysRef.current.delete(m.clientNonce);
      }
      setDmError(t("messages.errors.cannotSend"));
      const dropIds = new Set(dropped.map((m) => m._id));
      const next = prev.filter((m) => !dropIds.has(m._id));
      if (targetRef.current) writeMessagePageCache(targetRef.current, next);
      return next;
    });
    void loadMessages();
    const current = targetRef.current;
    if (current?.type === "channel") {
      requestChannelVoiceState(current.channel._id);
    } else if (current?.type === "dm") {
      seedPresence([current.contact]);
    }
  }, [wsConnected, loadMessages, targetKey, seedPresence, requestChannelVoiceState, t]);

  useEffect(() => {
    return subscribePendingDrop((key, clientNonce) => {
      pendingSendKeysRef.current.delete(clientNonce);
      if (activeChatKeyRef.current !== key) return;
      setMessages((prev) => {
        const next = prev.filter((m) => m.clientNonce !== clientNonce);
        return next.length === prev.length ? prev : next;
      });
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setMessages((prev) => {
        const now = Date.now();
        const dropped: string[] = [];
        const next = prev.filter((m) => {
          if (!m.pending) return true;
          const age = now - new Date(m.timestamp).getTime();
          if (age < PENDING_MESSAGE_TTL_MS) return true;
          if (m.clientNonce) dropped.push(m.clientNonce);
          return false;
        });
        if (next.length === prev.length) return prev;
        for (const nonce of dropped) {
          pendingSendKeysRef.current.delete(nonce);
        }
        if (dropped.length > 0) {
          setDmError(t("messages.errors.cannotSend"));
        }
        if (target) writeMessagePageCache(target, next);
        return next;
      });
    }, 5_000);
    return () => window.clearInterval(id);
  }, [target, t]);

  useEffect(() => {
    if (target?.type !== "channel") return;
    requestChannelVoiceState(target.channel._id);
  }, [target, requestChannelVoiceState]);

  useEffect(() => {
    if (!target || target.type !== "dm") {
      setIsFriend(true);
      setIsBlockedByMe(false);
      setIsBlockedByOther(false);
      return;
    }

    const contactId = target.contact._id;
    setIsBlockedByMe(Boolean(target.contact.isBlockedByMe));

    const cached = getCachedFriendship(contactId);
    if (cached) {
      setIsFriend(cached.isFriend);
      setIsBlockedByMe(cached.isBlockedByMe);
      setIsBlockedByOther(cached.isBlockedByOther);
      setFriendshipLoading(false);

      let cancelled = false;
      checkFriendship(contactId)
        .then((res) => {
          if (cancelled) return;
          setCachedFriendship(contactId, {
            isFriend: res.isFriend,
            isBlockedByMe: Boolean(res.isBlockedByMe),
            isBlockedByOther: Boolean(res.isBlockedByOther),
          });
          setIsFriend(res.isFriend);
          setIsBlockedByMe(Boolean(res.isBlockedByMe));
          setIsBlockedByOther(Boolean(res.isBlockedByOther));
        })
        .catch(() => {});
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    setFriendshipLoading(true);
    setIsFriend(false);
    setIsBlockedByOther(false);
    checkFriendship(contactId)
      .then((res) => {
        if (cancelled) return;
        setCachedFriendship(contactId, {
          isFriend: res.isFriend,
          isBlockedByMe: Boolean(res.isBlockedByMe),
          isBlockedByOther: Boolean(res.isBlockedByOther),
        });
        setIsFriend(res.isFriend);
        setIsBlockedByMe(Boolean(res.isBlockedByMe));
        setIsBlockedByOther(Boolean(res.isBlockedByOther));
      })
      .catch(() => {

        if (cancelled) return;
        const cached = getCachedFriendship(contactId);
        if (cached) {
          setIsFriend(cached.isFriend);
          setIsBlockedByMe(Boolean(cached.isBlockedByMe));
          setIsBlockedByOther(Boolean(cached.isBlockedByOther));
        } else {
          setIsFriend(false);
        }
      })
      .finally(() => {
        if (!cancelled) setFriendshipLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target?.type === "dm" ? target.contact._id : null, friendshipEpoch]);

  useEffect(() => {
    if (!target || target.type !== "dm") return;
    const contactId = target.contact._id;
    let cancelled = false;
    const id = window.setInterval(() => {
      if (getCachedFriendship(contactId)) return;

      checkFriendship(contactId)
        .then((res) => {
          if (cancelled || activeChatKeyRef.current !== `dm:${contactId}`) return;
          setCachedFriendship(contactId, {
            isFriend: res.isFriend,
            isBlockedByMe: Boolean(res.isBlockedByMe),
            isBlockedByOther: Boolean(res.isBlockedByOther),
          });
          setIsFriend(res.isFriend);
          setIsBlockedByMe(Boolean(res.isBlockedByMe));
          setIsBlockedByOther(Boolean(res.isBlockedByOther));
        })
        .catch(() => {});
    }, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [target?.type === "dm" ? target.contact._id : null]);

  useEffect(() => {
    if (!user?.id || target?.type !== "dm") return;

    const contactId = target.contact._id;
    const userId = user.id;
    const mark = { kind: "dm" as const, userId, contactId };

    const sessionGen = getPendingMarkReadGeneration();
    const armOffline = () => {
      if (getPendingMarkReadGeneration() !== sessionGen) return;
      const g = getPendingMarkReadGeneration();
      trackMarkReadInFlight(mark);
      queuePendingMarkRead(mark, g);
    };
    const sendMark = () => {
      if (getPendingMarkReadGeneration() !== sessionGen) return;
      if (!ws || !wsConnected) {
        armOffline();
        return;
      }
      const g = getPendingMarkReadGeneration();
      trackMarkReadInFlight(mark);
      void ws
        .send(WsType.MARK_CONVERSATION_READ, { userId, contactId })
        .then((ok) => {
          if (getPendingMarkReadGeneration() !== sessionGen) return;
          if (!ok) queuePendingMarkRead(mark, g);
        })
        .catch(() => {
          if (getPendingMarkReadGeneration() !== sessionGen) return;
          queuePendingMarkRead(mark, g);
        });
    };

    sendMark();
    return () => {
      sendMark();
    };
  }, [
    ws,
    user?.id,
    target?.type === "dm" ? target.contact._id : null,
    wsConnected,
  ]);

  useEffect(() => {
    if (!user?.id || target?.type !== "channel") {
      return;
    }
    const channelId = target.channel._id;
    const userId = user.id;
    const mark = { kind: "channel" as const, userId, channelId };

    const sessionGen = getPendingMarkReadGeneration();
    const armOffline = () => {
      if (getPendingMarkReadGeneration() !== sessionGen) return;
      const g = getPendingMarkReadGeneration();
      trackMarkReadInFlight(mark);
      queuePendingMarkRead(mark, g);
    };
    const sendMark = () => {
      if (getPendingMarkReadGeneration() !== sessionGen) return;
      if (!ws || !wsConnected) {
        armOffline();
        return;
      }
      const g = getPendingMarkReadGeneration();
      trackMarkReadInFlight(mark);
      lastChannelMarkReadAtRef.current = Date.now();
      void ws
        .send(WsType.MARK_CHANNEL_READ, { userId, channelId })
        .then((ok) => {
          if (getPendingMarkReadGeneration() !== sessionGen) return;
          if (!ok) queuePendingMarkRead(mark, g);
        })
        .catch(() => {
          if (getPendingMarkReadGeneration() !== sessionGen) return;
          queuePendingMarkRead(mark, g);
        });
    };
    sendMark();
    return () => {
      sendMark();
    };
  }, [
    ws,
    user?.id,
    target?.type === "channel" ? target.channel._id : null,
    wsConnected,
  ]);

  useEffect(() => {
    return () => {
      if (channelMarkReadTimerRef.current) {
        clearTimeout(channelMarkReadTimerRef.current);
        channelMarkReadTimerRef.current = undefined;
      }
    };
  }, []);

  useEffect(() => {
    const markCurrentRead = () => {
      const current = targetRef.current;
      const userId = userIdRef.current;
      const socket = wsRef.current;

      if (!current || !userId) return;

      if (getPendingMarkReadGeneration() !== markSessionGenRef.current) return;
      if (current.type === "dm") {
        const contactId = current.contact._id;
        const mark = { kind: "dm" as const, userId, contactId };

        queuePendingMarkReadSync(mark);
        trackMarkReadInFlight(mark);

        if (socket) {
          void socket.send(WsType.MARK_CONVERSATION_READ, { userId, contactId });
        }
        return;
      }
      const channelId = current.channel._id;
      const mark = { kind: "channel" as const, userId, channelId };
      queuePendingMarkReadSync(mark);
      trackMarkReadInFlight(mark);
      if (socket) {
        void socket.send(WsType.MARK_CHANNEL_READ, { userId, channelId });
      }
    };
    const onPageHide = () => markCurrentRead();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") markCurrentRead();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (!ws) return;

    const appendMessage = (msg: Message) => {
      const current = targetRef.current;
      if (!current) return;
      const next = prepareForDisplay([msg])[0];
      if (!next) return;
      if (next.clientNonce) pendingSendKeysRef.current.delete(next.clientNonce);
      setMessages((prev) => {
        const merged = replacePendingWithServer(prev, next, currentUserId);
        writeMessagePageCache(current, merged);
        return merged;
      });
    };

    const onDm = (msg: Message) => {
      const target = targetRef.current;
      if (!target || target.type !== "dm") return;
      const contactId = target.contact._id;
      const senderId =
        typeof msg.sender === "object" ? msg.sender._id ?? msg.sender.id : msg.sender;
      const recipientId =
        typeof msg.recipient === "object"
          ? msg.recipient?._id ?? msg.recipient?.id
          : msg.recipient;
      const involves =
        (senderId === contactId || recipientId === contactId) &&
        (senderId === currentUserId || recipientId === currentUserId);
      if (involves) {
        appendMessage(msg);

        if (recipientId === currentUserId && senderId === contactId) {
          if (getPendingMarkReadGeneration() !== markSessionGenRef.current) return;
          const mark = {
            kind: "dm" as const,
            userId: currentUserId,
            contactId,
          };
          const g = getPendingMarkReadGeneration();
          trackMarkReadInFlight(mark);
          void ws
            .send(WsType.MARK_MESSAGE_READ, {
              messageId: msg._id,
              userId: currentUserId,
            })
            .then((ok) => {
              if (getPendingMarkReadGeneration() !== markSessionGenRef.current) return;
              if (!ok) queuePendingMarkRead(mark, g);
            })
            .catch(() => {
              if (getPendingMarkReadGeneration() !== markSessionGenRef.current) return;
              queuePendingMarkRead(mark, g);
            });
        }
      }
    };

    const onChannel = (msg: Message & { channelId?: string }) => {
      const target = targetRef.current;
      if (!target || target.type !== "channel") return;
      const chId = msg.channelId ?? msg.channel;
      if (chId === target.channel._id) {
        appendMessage(msg);

        const channelId = target.channel._id;
        const sendMark = () => {
          if (getPendingMarkReadGeneration() !== markSessionGenRef.current) return;
          lastChannelMarkReadAtRef.current = Date.now();
          const mark = {
            kind: "channel" as const,
            userId: currentUserId,
            channelId,
          };
          const g = getPendingMarkReadGeneration();
          trackMarkReadInFlight(mark);
          void ws
            .send(WsType.MARK_CHANNEL_READ, {
              userId: currentUserId,
              channelId,
            })
            .then((ok) => {
              if (getPendingMarkReadGeneration() !== markSessionGenRef.current) return;
              if (!ok) queuePendingMarkRead(mark, g);
            })
            .catch(() => {
              if (getPendingMarkReadGeneration() !== markSessionGenRef.current) return;
              queuePendingMarkRead(mark, g);
            });
        };
        const now = Date.now();
        if (now - lastChannelMarkReadAtRef.current >= 1_000) {
          if (channelMarkReadTimerRef.current) {
            clearTimeout(channelMarkReadTimerRef.current);
            channelMarkReadTimerRef.current = undefined;
          }
          sendMark();
        } else if (!channelMarkReadTimerRef.current) {

          channelMarkReadTimerRef.current = setTimeout(() => {
            channelMarkReadTimerRef.current = undefined;
            if (activeChatKeyRef.current === `ch:${channelId}`) sendMark();
          }, 400);
        }
      }
    };

    const onEdited = (msg: Message) => {
      const target = targetRef.current;
      const next = prepareForDisplay([msg])[0];
      if (!next) return;
      const patchQuotes = (m: Message): Message => {
        const base =
          m._id === next._id ||
          (Boolean(m.clientNonce) && m.clientNonce === next.clientNonce)
            ? mergeMessagePatch(m, next)
            : m;
        const q = base.quotedMessage;
        if (q && typeof q === "object" && q._id === next._id) {
          return {
            ...base,
            quotedMessage: mergeMessagePatch(q, next),
          };
        }
        return base;
      };
      setMessages((prev) => {
        const patched = prev.map(patchQuotes);
        const updated = patched.some(
          (m) =>
            m._id === next._id ||
            (Boolean(m.clientNonce) && m.clientNonce === next.clientNonce),
        )
          ? patched
          : replacePendingWithServer(patched, next, currentUserId);
        if (target) writeMessagePageCache(target, updated);
        return updated;
      });
      setEditingMessage((cur) =>
        cur && cur._id === next._id ? mergeMessagePatch(cur, next) : cur,
      );
      setReplyingTo((cur) =>
        cur && cur._id === next._id ? mergeMessagePatch(cur, next) : cur,
      );
    };

    const onReaction = (data: {
      messageId: string;
      reactions: MessageReactions;
      channelId?: string;
    }) => {
      const target = targetRef.current;
      if (target?.type === "channel") {
        if (data.channelId && data.channelId !== target.channel._id) return;
      }

      setMessages((prev) => {
        const exists = prev.some((m) => m._id === data.messageId);
        if (!exists) return prev;

        const updated = prev.map((m) =>
          m._id === data.messageId
            ? { ...m, reactions: normalizeReactions(data.reactions) }
            : m,
        );
        if (target) writeMessagePageCache(target, updated);
        return updated;
      });
    };

    const onDeleted = (data: { _id: string }) => {
      const target = targetRef.current;
      setMessages((prev) => {
        const updated = prev
          .map((m) => {
            if (m._id === data._id) return null;
            const q = m.quotedMessage;
            if (q && typeof q === "object" && q._id === data._id) {
              return { ...m, quotedMessage: { ...q, deleted: true } };
            }
            return m;
          })
          .filter((m): m is Message => m != null);
        if (target) writeMessagePageCache(target, updated);
        return updated;
      });
      setEditingMessage((cur) => (cur?._id === data._id ? null : cur));
      setReplyingTo((cur) => (cur?._id === data._id ? null : cur));
      setDeleteConfirm((cur) => (cur?.messageId === data._id ? null : cur));
    };

    const onMessageRead = (data: {
      messageId?: string;
      _id?: string;
      read: boolean;
    }) => {
      const target = targetRef.current;
      if (!target || target.type !== "dm") return;
      const id = data.messageId ?? data._id;
      if (!id) return;
      setMessages((prev) => {
        const updated = prev.map((m) =>
          m._id === id ? { ...m, read: data.read } : m,
        );
        writeMessagePageCache(target, updated);
        return updated;
      });
    };

    const onMessagesRead = (data: {
      messageIds?: string[];
      read: boolean;
      readerId: string;
      conversationRead?: boolean;
    }) => {
      const target = targetRef.current;
      if (!target || target.type !== "dm") return;
      if (data.readerId !== target.contact._id) return;

      if (data.conversationRead) {
        setMessages((prev) => {
          const updated = prev.map((m) => {
            const senderId =
              typeof m.sender === "object" ? m.sender._id ?? m.sender.id : m.sender;
            return senderId === currentUserId ? { ...m, read: data.read } : m;
          });
          writeMessagePageCache(target, updated);
          return updated;
        });
        return;
      }

      const ids = new Set(data.messageIds ?? []);
      setMessages((prev) => {
        const updated = prev.map((m) =>
          ids.has(m._id) ? { ...m, read: data.read } : m,
        );
        writeMessagePageCache(target, updated);
        return updated;
      });
    };

    const applyTyping = (userId: string | null, isTyping: boolean) => {
      if (typingClearTimeout.current) {
        clearTimeout(typingClearTimeout.current);
        typingClearTimeout.current = undefined;
      }
      if (isTyping && userId) {
        setTypingUserId(userId);
        typingClearTimeout.current = setTimeout(
          () => setTypingUserId(null),
          4000,
        );
      } else {
        setTypingUserId(null);
      }
    };

    const onTyping = (data: {
      chatId: string;
      userId: string;
      isTyping: boolean;
    }) => {
      const target = targetRef.current;
      if (!target) return;
      if (target.type === "dm") {
        if (
          data.userId === target.contact._id &&
          data.chatId === currentUserId
        ) {
          applyTyping(data.userId, data.isTyping);
        }
      } else if (
        data.chatId === `channel_${target.channel._id}` &&
        data.userId !== currentUserId
      ) {
        applyTyping(data.userId, data.isTyping);
      }
    };

    const onDmError = (data: {
      code?: string;
      message?: string;
      clientNonce?: string;
    }) => {
      const target = targetRef.current;
      const sendKey = data.clientNonce
        ? pendingSendKeysRef.current.get(data.clientNonce) ??
          lastSendChatKeyRef.current
        : lastSendChatKeyRef.current;
      if (data.clientNonce) pendingSendKeysRef.current.delete(data.clientNonce);
      const dropPending = (msgs: Message[]) => {
        if (data.clientNonce) {
          return msgs.filter((m) => m.clientNonce !== data.clientNonce);
        }

        let last = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].pending) {
            last = i;
            break;
          }
        }
        return last < 0 ? msgs : msgs.filter((_, i) => i !== last);
      };

      if (data.clientNonce) {
        publishSidebarTipRevert({
          _id: `temp-${data.clientNonce}`,
          clientNonce: data.clientNonce,
        } as Message);
      }
      if (sendKey && (!target || chatCacheKey(target) !== sendKey)) {
        const cached = getMessagePageCache(sendKey);
        if (cached) {
          patchCacheLive(sendKey, dropPending(cached.messages), cached.hasMore);
        }
      } else if (target?.type === "dm") {
        setMessages((prev) => {
          const next = dropPending(prev);
          if (next.length !== prev.length) writeMessagePageCache(target, next);
          return next;
        });
      }

      if (!target || target.type !== "dm") return;
      const contactId = target.contact._id;
      if (sendKey && sendKey !== `dm:${contactId}`) return;

      if (data.code === "NOT_FRIENDS" && data.message) {
        if (activeChatKeyRef.current === sendKey) setDmError(data.message);
        setIsFriend(false);
        setCachedFriendship(contactId, {
          isFriend: false,
          isBlockedByMe: isBlockedByMeRef.current,
          isBlockedByOther: isBlockedByOtherRef.current,
        });
      }
      if (data.code === "USER_BLOCKED" && data.message) {
        if (activeChatKeyRef.current === sendKey) setDmError(data.message);
        const byMe =
          typeof (data as { blockedByMe?: boolean }).blockedByMe === "boolean"
            ? Boolean((data as { blockedByMe?: boolean }).blockedByMe)
            : isBlockedByMeRef.current;
        const byOther =
          typeof (data as { blockedByOther?: boolean }).blockedByOther ===
          "boolean"
            ? Boolean((data as { blockedByOther?: boolean }).blockedByOther)
            : true;
        setIsBlockedByMe(byMe);
        setIsBlockedByOther(byOther);
        setCachedFriendship(contactId, {
          isFriend: isFriendRef.current,
          isBlockedByMe: byMe,
          isBlockedByOther: byOther,
        });
      }
    };

    const onWsError = (data: {
      code?: string;
      message?: string;
      clientNonce?: string;
    }) => {
      const target = targetRef.current;
      const sendRelated =
        data.code === "QUEUE_FULL" ||
        data.code === "SEND_FAILED" ||
        data.code === "INVALID_FILE" ||
        data.code === "CONTENT_TOO_LONG" ||
        data.code === "RATE_LIMITED" ||
        data.code === "FORBIDDEN" ||
        data.code === "CHAT_LOCKED" ||
        data.code === "SLOWMODE";
      if (!sendRelated) return;
      const sendKey = data.clientNonce
        ? pendingSendKeysRef.current.get(data.clientNonce) ??
          lastSendChatKeyRef.current
        : lastSendChatKeyRef.current;
      if (!sendKey) return;
      if (data.clientNonce) {
        pendingSendKeysRef.current.delete(data.clientNonce);
        publishSidebarTipRevert({
          _id: `temp-${data.clientNonce}`,
          clientNonce: data.clientNonce,
        } as Message);
      }

      const dropPending = (msgs: Message[]) => {
        if (!msgs.some((m) => m.pending)) return msgs;
        if (data.clientNonce) {
          return msgs.filter((m) => m.clientNonce !== data.clientNonce);
        }
        if (data.code === "QUEUE_FULL") return msgs.filter((m) => !m.pending);
        let last = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].pending) {
            last = i;
            break;
          }
        }
        return last < 0 ? msgs : msgs.filter((_, i) => i !== last);
      };

      if (!target || chatCacheKey(target) !== sendKey) {
        const cached = getMessagePageCache(sendKey);
        if (cached) {
          patchCacheLive(sendKey, dropPending(cached.messages), cached.hasMore);
        }
        return;
      }
      setMessages((prev) => {
        const next = dropPending(prev);
        if (next === prev) return prev;
        writeMessagePageCache(target, next);
        return next;
      });
      if (data.message && activeChatKeyRef.current === sendKey) setDmError(data.message);
    };

    const unsubs = [
      ws.subscribe(WsType.RECEIVE_MESSAGE, onDm),
      ws.subscribe(WsType.RECEIVE_CHANNEL_MESSAGE, onChannel),
      ws.subscribe(WsType.MESSAGE_EDITED, onEdited),
      ws.subscribe(WsType.MESSAGE_REACTION, onReaction),
      ws.subscribe(WsType.MESSAGE_DELETED, onDeleted),
      ws.subscribe(WsType.MESSAGE_READ, onMessageRead),
      ws.subscribe(WsType.MESSAGES_READ, onMessagesRead),
      ws.subscribe(WsType.TYPING, onTyping),
      ws.subscribe(WsType.DM_ERROR, onDmError),
      ws.subscribe(WsType.ERROR, onWsError),
    ];

    return () => unsubs.forEach((u) => u());
  }, [ws, target?.type === "dm" ? target.contact._id : target?.type === "channel" ? target.channel._id : null, currentUserId, prepareForDisplay]);

  useProfileSync(ws, {
    onInfo: ({ userId, username, displayName, bio, color }) =>
      setMessages((prev) => {
        const updated = prev.map((m) =>
          patchMessageSender(m, userId, {
            username: username ?? undefined,
            displayName: displayName ?? undefined,
            bio: bio ?? undefined,
            color: color ?? undefined,
          }),
        );
        if (target) writeMessagePageCache(target, updated);
        return updated;
      }),
    onImage: ({ userId, image }) =>
      setMessages((prev) => {
        const updated = prev.map((m) =>
          patchMessageSender(m, userId, { image }),
        );
        if (target) writeMessagePageCache(target, updated);
        return updated;
      }),
    onBanner: ({ userId, banner }) =>
      setMessages((prev) => {
        const updated = prev.map((m) =>
          patchMessageSender(m, userId, { banner }),
        );
        if (target) writeMessagePageCache(target, updated);
        return updated;
      }),
  });

  const pushOptimistic = useCallback(
    (partial: Omit<Message, "_id" | "timestamp" | "sender" | "pending"> & {
      content: string;
    }): string | null => {
      if (!user || !target) return null;
      const clientNonce = crypto.randomUUID();
      const sendKey = chatCacheKey(target);
      lastSendChatKeyRef.current = sendKey;
      pendingSendKeysRef.current.set(clientNonce, sendKey);
      const optimistic: Message = {
        _id: `temp-${clientNonce}`,
        sender: {
          _id: user.id,
          username: user.username,
          displayName: user.displayName,
          image: user.image,
          color: user.color ?? undefined,
        },
        timestamp: new Date().toISOString(),
        pending: true,
        clientNonce,
        read: false,
        ...partial,
        ...(target.type === "dm"
          ? {
              recipient: {
                _id: target.contact._id,
                username: target.contact.username,
                displayName: target.contact.displayName,
                image: target.contact.image,
                color: target.contact.color,
              },
            }
          : {
              channelId: target.channel._id,
              channel: target.channel._id,
            }),
      };
      setMessages((prev) => {
        const next = [...prev, optimistic];
        writeMessagePageCache(target, next);
        return next;
      });
      publishSidebarTipFromMessage(optimistic);
      return clientNonce;
    },
    [user, target],
  );

  const sendFileMessage = useCallback(
    async (
      file: File,
      options?: {
        messageType?: "IMAGE" | "VIDEO" | "AUDIO" | "FILE" | "STICKER";
        content?: string;
        durationMs?: number;
      },
    ) => {
      if (!ws || !target || !user || !canSendDm) {
        throw new Error(t("messages.errors.cannotSendFile"));
      }

      const uploadContext =
        target.type === "dm"
          ? ({ type: "dm", contactId: target.contact._id } as const)
          : ({ type: "channel", channelId: target.channel._id } as const);
      const quotedMessage = replyingTo?._id;
      const quotePayload = quotedMessage ? { quotedMessage } : {};
      const messageType = options?.messageType ?? resolveUploadMessageType(file);

      const { filePath, scanStatus } = await uploadFile(file, uploadContext);
      const sendKey = chatCacheKey(target);
      const resolvedScan = scanStatus === "clean" ? "clean" : "pending";
      const visibleFileUrl = resolvedScan === "clean" ? filePath : undefined;

      const stillActive = activeChatKeyRef.current === sendKey;
      const rawContent =
        options?.content ??
        (uploadUsesFileNameAsContent(messageType) ? file.name : "");
      const payload = {
        sender: user.id,
        content: rawContent ? wrapOutgoingContent(rawContent) : rawContent,
        messageType,
        fileUrl: filePath,
        fileName: file.name,
        fileType: file.type || "application/octet-stream",
        fileSize: file.size,
        ...(options?.durationMs != null ? { durationMs: options.durationMs } : {}),
        ...quotePayload,
      };

      const clientNonce = stillActive
        ? pushOptimistic({
            content: rawContent,
            messageType,
            fileUrl: visibleFileUrl,
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            scanStatus: resolvedScan,
            ...(options?.durationMs != null ? { durationMs: options.durationMs } : {}),
            ...(replyingTo ? { quotedMessage: replyingTo } : {}),
          })
        : crypto.randomUUID();
      if (!stillActive && clientNonce && user) {
        lastSendChatKeyRef.current = sendKey;
        pendingSendKeysRef.current.set(clientNonce, sendKey);

        ensureOptimisticInCache(sendKey, {
          _id: `temp-${clientNonce}`,
          sender: {
            _id: user.id,
            username: user.username,
            displayName: user.displayName,
            image: user.image,
            color: user.color ?? undefined,
          },
          timestamp: new Date().toISOString(),
          pending: true,
          clientNonce,
          read: false,
          content: rawContent,
          messageType,
          fileUrl: visibleFileUrl,
          fileName: file.name,
          fileType: file.type || "application/octet-stream",
          scanStatus: resolvedScan,
          ...(options?.durationMs != null ? { durationMs: options.durationMs } : {}),
          ...(replyingTo ? { quotedMessage: replyingTo } : {}),
          ...(target.type === "dm"
            ? {
                recipient: {
                  _id: target.contact._id,
                  username: target.contact.username,
                  displayName: target.contact.displayName,
                  image: target.contact.image,
                  color: target.contact.color,
                },
              }
            : {
                channelId: target.channel._id,
                channel: target.channel._id,
              }),
        });
      }

      const wire = { ...payload, clientNonce };
      const sent =
        target.type === "dm"
          ? await ws.send(WsType.SEND_MESSAGE, {
              ...wire,
              recipient: target.contact._id,
            })
          : await ws.send(WsType.SEND_CHANNEL_MESSAGE, {
              ...wire,
              channelId: target.channel._id,
            });
      if (!sent && clientNonce) {
        const dropped = {
          _id: `temp-${clientNonce}`,
          clientNonce,
        } as Message;
        dropPendingNonceFromCache(sendKey, clientNonce);
        publishSidebarTipRevert(dropped);
        if (activeChatKeyRef.current === sendKey) {
          setMessages((prev) => prev.filter((m) => m.clientNonce !== clientNonce));
        }
        if (stillActive) setDmError(t("messages.errors.cannotSendFile"));
      }
      if (stillActive) setReplyingTo(null);
    },
    [
      ws,
      target,
      user,
      canSendDm,
      replyingTo,
      t,
      pushOptimistic,
    ],
  );

  const sendRemoteMediaMessage = useCallback(
    (
      mediaUrl: string,
      title: string,
      fileType: string,
      messageType: "IMAGE" | "STICKER",
    ) => {
      if (!ws || !target || !user || !canSendDm) return;
      if (!isAllowedGifMediaUrl(mediaUrl)) return;

      const quotedMessage = replyingTo?._id;
      const quotePayload = quotedMessage ? { quotedMessage } : {};
      const fileName =
        (title || "media").replace(/\.[^.]+$/, "").trim() || "media";
      const payload = {
        sender: user.id,
        content: wrapOutgoingContent(fileName),
        messageType,
        fileUrl: mediaUrl,
        fileName: `${fileName}.gif`,
        fileType: fileType || "image/gif",
        ...quotePayload,
      };

      const clientNonce = pushOptimistic({
        content: fileName,
        messageType,
        fileUrl: mediaUrl,
        fileName: `${fileName}.gif`,
        fileType: fileType || "image/gif",
        ...(replyingTo ? { quotedMessage: replyingTo } : {}),
      });

      const wire = { ...payload, clientNonce };
      void (async () => {
        const sent =
          target.type === "dm"
            ? await ws.send(WsType.SEND_MESSAGE, {
                ...wire,
                recipient: target.contact._id,
              })
            : await ws.send(WsType.SEND_CHANNEL_MESSAGE, {
                ...wire,
                channelId: target.channel._id,
              });
        if (!sent && clientNonce) {
          const key = chatCacheKey(target);
          dropPendingNonceFromCache(key, clientNonce);
          publishSidebarTipRevert({
            _id: `temp-${clientNonce}`,
            clientNonce,
          } as Message);
          if (activeChatKeyRef.current === key) {
            setMessages((prev) => prev.filter((m) => m.clientNonce !== clientNonce));
            setDmError(t("messages.errors.cannotSend"));
          }
        }
      })();
      setReplyingTo(null);
    },
    [ws, target, user, canSendDm, replyingTo, pushOptimistic, t],
  );

  const sendMessage = async (content: string) => {
    if (!ws || !target || !user || !canSendDm) return;
    if (editingMessage) {
      const editingId = editingMessage._id;
      const sent = await ws.send(WsType.EDIT_MESSAGE, {
        messageId: editingId,
        content: wrapOutgoingContent(content),
        userId: user.id,
      });
      if (sent) {
        setEditingMessage(null);
      } else if (activeChatKeyRef.current === chatCacheKey(target)) {
        setDmError(t("messages.errors.cannotSend"));
      }
      return;
    }

    const quotedMessage = replyingTo?._id;
    const quotePayload = quotedMessage ? { quotedMessage } : {};
    const externalMedia = resolveSingleExternalMediaSend(content);

    const payload = externalMedia
      ? {
          sender: user.id,
          content: wrapOutgoingContent(externalMedia.fileName),
          messageType: "IMAGE" as const,
          fileUrl: externalMedia.url,
          fileName: externalMedia.fileName,
          fileType: externalMedia.fileType,
          ...quotePayload,
        }
      : {
          sender: user.id,
          content: wrapOutgoingContent(content),
          messageType: "TEXT" as const,
          ...quotePayload,
        };

    const clientNonce = pushOptimistic(
      externalMedia
        ? {
            content: externalMedia.fileName,
            messageType: "IMAGE",
            fileUrl: externalMedia.url,
            fileName: externalMedia.fileName,
            fileType: externalMedia.fileType,
            ...(replyingTo ? { quotedMessage: replyingTo } : {}),
          }
        : {
            content,
            messageType: "TEXT",
            ...(replyingTo ? { quotedMessage: replyingTo } : {}),
          },
    );

    const wire = { ...payload, clientNonce };
    void (async () => {
      const sent =
        target.type === "dm"
          ? await ws.send(WsType.SEND_MESSAGE, {
              ...wire,
              recipient: target.contact._id,
            })
          : await ws.send(WsType.SEND_CHANNEL_MESSAGE, {
              ...wire,
              channelId: target.channel._id,
            });
      if (!sent && clientNonce) {
        const key = chatCacheKey(target);
        dropPendingNonceFromCache(key, clientNonce);
        publishSidebarTipRevert({
          _id: `temp-${clientNonce}`,
          clientNonce,
        } as Message);
        if (activeChatKeyRef.current === key) {
          setMessages((prev) => prev.filter((m) => m.clientNonce !== clientNonce));
          setDmError(t("messages.errors.cannotSend"));
        }
      }
    })();

    setReplyingTo(null);
  };

  const handleTyping = (isTyping: boolean) => {
    if (!ws || !target || !user) return;
    const chatId = target.type === "dm" ? target.contact._id : `channel_${target.channel._id}`;
    ws.send(WsType.TYPING, { chatId, isTyping });
  };

  const handleFile = async (file: File) => {
    await sendFileMessage(file);
  };

  const handleVoiceNote = async (file: File, durationMs: number) => {
    if (!ws || !target || !user || !canSendDm) {
      throw new Error(t("messages.errors.cannotSendVoice"));
    }
    await sendFileMessage(file, { messageType: "AUDIO", content: "", durationMs });
  };

  const handleGif = (gifUrl: string, gifTitle: string) => {
    sendRemoteMediaMessage(gifUrl, gifTitle, "image/gif", "IMAGE");
  };

  const handleSticker = (stickerUrl: string, stickerTitle: string) => {
    sendRemoteMediaMessage(stickerUrl, stickerTitle, "image/gif", "STICKER");
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!ws || !currentUserId || !canReact || !target) return;
    if (messageId.startsWith("temp-")) return;

    const key = chatCacheKey(target);
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m._id === messageId
          ? {
              ...m,
              reactions: toggleReactionLocal(m.reactions, emoji, currentUserId),
            }
          : m,
      );
      writeMessagePageCache(target, updated);
      return updated;
    });

    void (async () => {
      const sent = await ws.send(WsType.MESSAGE_REACTION, {
        messageId,
        emoji,
      });
      if (!sent) {

        patchCachedMessageEverywhere(messageId, (m) => ({
          ...m,
          reactions: toggleReactionLocal(m.reactions, emoji, currentUserId),
        }));
        if (activeChatKeyRef.current === key) {
          setMessages((prev) =>
            prev.map((m) =>
              m._id === messageId
                ? {
                    ...m,
                    reactions: toggleReactionLocal(
                      m.reactions,
                      emoji,
                      currentUserId,
                    ),
                  }
                : m,
            ),
          );
        }
      }
    })();
  };

  const handleDelete = (message: Message) => {
    if (message.pending) return;
    const isFile = message.messageType && message.messageType !== "TEXT";
    const preview = isFile
      ? isVoiceAttachment(message)
        ? t("messages.audio")
        : message.messageType === "VIDEO" || message.fileType?.startsWith("video/")
          ? t("messages.video")
        : (message.fileName ?? t("messages.attachment"))
      : stripFormatting(message.content);
    setDeleteConfirm({
      messageId: message._id,
      preview,
    });
  };

  const handleEdit = (message: Message) => {
    if (message.pending) return;
    setReplyingTo(null);
    setEditingMessage(message);
  };

  const handleReply = (message: Message) => {
    if (message.pending) return;
    setEditingMessage(null);
    setReplyingTo(message);
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
  };

  const handleImageClick = useCallback(
    (message: Message) => {
      const index = imageLightboxItems.findIndex(
        (item) =>
          item.messageId === message._id ||
          (message.fileUrl != null && item.url === message.fileUrl),
      );
      if (index >= 0) {
        setLightboxIndex(index);
      }
    },
    [imageLightboxItems],
  );

  const handleConfirmDelete = () => {
    if (!deleteConfirm || !ws) return;
    const messageId = deleteConfirm.messageId;
    void (async () => {
      const sent = await ws.send(WsType.DELETE_MESSAGE, {
        messageId,
        userId: currentUserId,
      });
      if (sent) setDeleteConfirm(null);
    })();
  };

  const applyMessageUpdate = (updated: Message, expectedKey?: string | null) => {
    const display = unwrapIncomingMessage(normalizeMessage(updated));
    patchCachedMessageEverywhere(display._id, (m) =>
      normalizeMessage(mergeMessagePatch(m, display)),
    );
    const key = expectedKey ?? (target ? chatCacheKey(target) : null);
    if (!key || activeChatKeyRef.current !== key || !target) return;
    setMessages((prev) => {
      const next = prev.map((m) =>
        m._id === display._id
          ? normalizeMessage(mergeMessagePatch(m, display))
          : m,
      );
      writeMessagePageCache(target, next);
      return next;
    });
  };

  const handlePin = async (message: Message) => {
    if (!target || message.pending) return;
    const key = chatCacheKey(target);
    try {
      const { message: updated } = await pinMessageHttp(message._id);
      applyMessageUpdate(updated, key);
    } catch {
      if (activeChatKeyRef.current === key) {
        setDmError(t("messages.errors.cannotSend"));
      }
    }
  };

  const handleUnpin = async (message: Message) => {
    if (!target || message.pending) return;
    const key = chatCacheKey(target);
    try {
      const { message: updated } = await unpinMessageHttp(message._id);
      applyMessageUpdate(updated, key);
    } catch {
      if (activeChatKeyRef.current === key) {
        setDmError(t("messages.errors.cannotSend"));
      }
    }
  };

  const handleJumpToMessage = (messageId: string) => {
    setToolsPanel(null);
    setHighlightMessageId(messageId);
    const tryScroll = () => {
      const el = document.querySelector(
        `.message-list [data-message-id="${messageId}"]`,
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
      return false;
    };
    void (async () => {
      if (tryScroll()) return;
      if (!target || !currentUserId) return;
      const gen = loadGenRef.current;
      const targetSnapshot = target;
      let working = messages;
      let more = hasMore;
      for (let page = 0; page < 25; page++) {
        if (working.some((m) => m._id === messageId)) {
          if (gen !== loadGenRef.current) return;

          setMessages((prev) => {
            const merged = mergeHttpWithLive(working, prev, currentUserId);
            writeMessagePageCache(targetSnapshot, merged, more);
            return merged;
          });
          setHasMore(more);
          requestAnimationFrame(() => {
            tryScroll();
          });
          return;
        }
        if (!more || working.length === 0) break;
        const oldest = working[0]._id;
        try {
          const next =
            targetSnapshot.type === "dm"
              ? await getMessages(targetSnapshot.contact._id, {
                  before: oldest,
                  limit: MESSAGE_PAGE_SIZE,
                })
              : await getChannelMessages(targetSnapshot.channel._id, {
                  before: oldest,
                  limit: MESSAGE_PAGE_SIZE,
                });
          if (gen !== loadGenRef.current) return;
          const older = prepareForDisplay(next.messages);
          const existing = new Set(working.map((m) => m._id));
          const merged = older.filter((m) => !existing.has(m._id));
          if (merged.length === 0) break;
          working = [...merged, ...working];
          more = Boolean(next.hasMore);
        } catch {
          break;
        }
      }
      requestAnimationFrame(() => {
        tryScroll();
      });
    })();
    window.setTimeout(() => setHighlightMessageId(null), 2500);
  };

  if (!target) {
    return (
      <div className="chat-window chat-window--empty">
        <p className="chat-window__empty-hint">{t("chat.empty.selectChat")}</p>
      </div>
    );
  }

  const dmContact =
    target.type === "dm"
      ? { ...target.contact, ...(dmPresence ?? {}) }
      : null;
  const title =
    target.type === "dm"
      ? userLabel(target.contact)
      : target.channel.name;

  const avatarProps =
    target.type === "dm"
      ? {
          displayName: target.contact.displayName,
          username: target.contact.username,
          image: target.contact.image,
          color: target.contact.color,
        }
      : { displayName: target.channel.name, image: target.channel.image, placeholder: "#" };

  return (
    <div className="chat-window">
      <header className="chat-header">

        {target.type === "dm" ? (
          <div style={{ position: "relative", display: "inline-flex" }}>
            <Avatar {...avatarProps} size={34} />
            <span
              className="presence-dot"
              title={
                dmContact?.isOnline
                  ? availabilityStatusLabel(dmContact.availabilityStatus ?? "online")
                  : availabilityStatusLabel("offline")
              }
              style={{
                background: presenceColor(dmContact ?? target.contact),
              }}
            />
          </div>
        ) : (
          <Avatar {...avatarProps} size={34} />
        )}
        <div className="chat-header__info">
          <h3 className="chat-header__name">{title}</h3>
          {target.type === "channel" && target.channel.description && (
            <span className="chat-header__desc">{target.channel.description}</span>
          )}
        </div>

        <div className="chat-header__actions">

          <div className="chat-header__toolbar">
            {target.type === "dm" && !friendshipLoading && canSendDm && (
              <IconBtn
                title={t("chat.window.call")}
                onClick={() =>
                  callState === "idle" &&
                  startCall(toCallPeer(target.contact), "audio")
                }
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l1.14-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </IconBtn>
            )}

            {target.type === "channel" && (
              <IconBtn
                title={
                  isInChannelVoice(target.channel._id)
                    ? t("call.channel.leave")
                    : t("call.channel.join")
                }
                active={
                  isInChannelVoice(target.channel._id) ||
                  isChannelVoiceActive(target.channel._id)
                }
                onClick={() =>
                  toggleChannelVoice({
                    _id: target.channel._id,
                    name: target.channel.name,
                    image: target.channel.image,
                  })
                }
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l1.14-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
              </IconBtn>
            )}

            {target.type === "dm" && !friendshipLoading && canSendDm && (
              <IconBtn
                title={t("chat.window.videoCall")}
                onClick={() =>
                  callState === "idle" &&
                  startCall(toCallPeer(target.contact), "video")
                }
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7"/>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                </svg>
              </IconBtn>
            )}

            <IconBtn
              title={t("chat.tools.pinned")}
              active={toolsPanel === "pinned"}
              onClick={() =>
                setToolsPanel((p) => (p === "pinned" ? null : "pinned"))
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="17" x2="12" y2="22"/>
                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
              </svg>
            </IconBtn>

            <IconBtn
              title={t("chat.tools.search")}
              active={toolsPanel === "search"}
              onClick={() =>
                setToolsPanel((p) => (p === "search" ? null : "search"))
              }
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </IconBtn>

            {target.type === "channel" && onOpenChannelSettings && (
              <IconBtn
                title={t("chat.window.channelSettings")}
                onClick={() => onOpenChannelSettings(target.channel)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </IconBtn>
            )}

            {target.type === "dm" && (
              <IconBtn title={t("chat.window.contactProfile")} onClick={() => setProfileOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </IconBtn>
            )}

            <div className="chat-header__toolbar-sep" aria-hidden="true" />

            <IconBtn title={t("chat.window.closeChat")} danger onClick={onClose}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </IconBtn>
          </div>
        </div>
      </header>

      {!wsConnected && (
        <div className="chat-offline-banner" role="status" aria-live="polite">
          <span className="chat-offline-dot" aria-hidden="true" />
          {t("errors.ws.reconnecting")}
        </div>
      )}

      <div className="chat-main">
        {toolsPanel && (
          <ChatTools
            mode={toolsPanel}
            target={target}
            canPin={canPin}
            onClose={() => setToolsPanel(null)}
            onUnpin={canPin ? handleUnpin : undefined}
            onJumpToMessage={handleJumpToMessage}
          />
        )}

        {loading ? (
          <div className="chat-loading">
            <div className="spinner" />
          </div>
        ) : (
          <MessageList
            messages={messages}
            currentUserId={currentUserId}
            typingUserId={typingUserId}
            highlightMessageId={highlightMessageId}
            hasMore={hasMore}
            loadingOlder={loadingOlder}
            onLoadOlder={loadOlderMessages}
            canReact={canReact}
            onReact={handleReaction}
            canReply={canReply}
            onReply={handleReply}
            onJumpToMessage={handleJumpToMessage}
            onImageClick={handleImageClick}
            showReadReceipt={showReadReceipt}
            onEdit={handleEdit}
            onDelete={handleDelete}
            canPin={canPin}
            onPin={canPin ? handlePin : undefined}
            onUnpin={canPin ? handleUnpin : undefined}
          />
        )}
      </div>

      {target.type === "dm" && !friendshipLoading && !canSendDm ? (
        <div
          style={{
            padding: "14px 18px",
            borderTop: `1px solid ${C.border}`,
            background: C.bgPanel,
            color: C.textMuted,
            fontSize: "0.85rem",
            lineHeight: 1.5,
            textAlign: "center",
            fontFamily: "var(--font-sans)",
          }}
        >
          {dmError ??
            (isDmBlocked && isFriend
              ? isBlockedByMe
                ? t("chat.input.blockedByYou")
                : t("chat.input.blockedByThem")
              : t("chat.input.notFriends"))}
        </div>
      ) : (
        <>
          {dmError ? (
            <div
              role="alert"
              style={{
                padding: "10px 18px",
                borderTop: `1px solid ${C.border}`,
                background: C.bgPanel,
                color: C.textMuted,
                fontSize: "0.85rem",
                lineHeight: 1.45,
                textAlign: "center",
                fontFamily: "var(--font-sans)",
              }}
            >
              {dmError}
            </div>
          ) : null}
          {target.type === "channel" && isChannelChatLocked ? (
            <div
              style={{
                padding: "14px 18px",
                borderTop: `1px solid ${C.border}`,
                background: C.bgPanel,
                color: C.textMuted,
                fontSize: "0.85rem",
                lineHeight: 1.5,
                textAlign: "center",
                fontFamily: "var(--font-sans)",
              }}
            >
              {t("chat.window.channelLocked")}
            </div>
          ) : target.type === "channel" && isChannelMuted ? (
            <div
              style={{
                padding: "14px 18px",
                borderTop: `1px solid ${C.border}`,
                background: C.bgPanel,
                color: C.textMuted,
                fontSize: "0.85rem",
                lineHeight: 1.5,
                textAlign: "center",
                fontFamily: "var(--font-sans)",
              }}
            >
              {t("chat.window.mutedOnChannel")}
            </div>
          ) : (
            <MessageInput
              key={
                target.type === "dm"
                  ? target.contact._id
                  : `channel_${target.channel._id}`
              }
              onSend={sendMessage}
              onTyping={handleTyping}
              onFile={handleFile}
              onVoiceNote={handleVoiceNote}
              onGif={handleGif}
              onSticker={handleSticker}
              disabled={
                !canSendChannel ||
                !wsConnected ||
                (target.type === "dm" && (friendshipLoading || !canSendDm))
              }
              placeholder={
                editingMessage
                  ? t("chat.input.editPlaceholder")
                  : replyingTo
                    ? t("chat.input.replyPlaceholder")
                    : friendshipLoading
                      ? t("chat.input.checkingPermissions")
                      : target.type === "channel"
                        ? t("chat.input.channelPlaceholder", {
                            channel: target.channel.name,
                          })
                        : t("chat.input.dmPlaceholder", {
                            name: userLabel(target.contact),
                          })
              }
              initialText={editingMessage?.content ?? ""}
              isEditing={Boolean(editingMessage)}
              onCancelEdit={handleCancelEdit}
              replyTo={replyingTo}
              onCancelReply={handleCancelReply}
              mentionCandidates={mentionCandidates}
              allowMentionEveryone={allowMentionEveryone}
            />
          )}
        </>
      )}

      {target.type === "dm" && (
        <OtherProfile
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={target.contact}
          isFriend={isFriend}
          isBlockedByMe={isBlockedByMe}
          onToggleBlock={
            isFriend
              ? async () => {
                  const res = await toggleContactBlock(target.contact._id);
                  setIsBlockedByMe(res.isBlocked);
                  setCachedFriendship(target.contact._id, {
                    isFriend: true,
                    isBlockedByMe: res.isBlocked,
                    isBlockedByOther,
                  });
                  setDmError(null);
                }
              : undefined
          }
          onRemove={
            isFriend && onRemoveContact
              ? () => onRemoveContact(target.contact)
              : undefined
          }
        />
      )}

      <DeleteMessage
        isOpen={Boolean(deleteConfirm)}
        preview={deleteConfirm?.preview ?? ""}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirm(null)}
      />

      {lightboxIndex !== null && imageLightboxItems.length > 0 && (
        <Lightbox
          items={imageLightboxItems}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
