import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  getMessages,
  uploadFile,
  pinMessageHttp,
  unpinMessageHttp,
} from "../../api/messages";
import { getChannelMessages } from "../../api/channels";
import { checkFriendship } from "../../api/friends";
import { toggleContactBlock } from "../../api/contacts";
import { useAuth } from "../../context/AuthContext";
import { useWebSocket, useWebSocketConnected } from "../../context/WebSocketContext";
import { WsType } from "../../api/wsProtocol";
import { useCall, type CallPeer } from "../../context/CallContext";
import { userLabel, availabilityStatusLabel } from "../../utils/user/format";
import { stripFormatting } from "../../utils/chat/messageFormat";
import {
  isVoiceAttachment,
  resolveUploadMessageType,
} from "../../utils/media/attachments";
import {
  extractExternalMediaLinks,
  resolveSingleExternalMediaSend,
} from "../../utils/media/externalMediaLinks";
import { isAllowedGifMediaUrl } from "../../utils/media/mediaAllowlist";
import { useProfileSync } from "../../hooks/useProfileSync";
import { presenceColor } from "../../utils/user/presence";
import {
  usePresenceStore,
  useResolvePresence,
} from "../../context/PresenceContext";
import {
  normalizeMessage,
} from "../../utils/chat/messages";
import { MESSAGE_PAGE_SIZE } from "../../constants/messages";
import {
  normalizeReactions,
  toggleReactionLocal,
} from "../../utils/chat/reactions";
import { Avatar } from "../common/Avatar";
import { OtherUserProfileModal } from "../profile/OtherUserProfileModal";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { DeleteMessageModal } from "./DeleteMessageModal";
import { ImageLightbox, type LightboxItem } from "./ImageLightbox";
import { ChatToolsPanel } from "./ChatToolsPanel";
import type {
  ChatTarget,
  Contact,
  MentionCandidate,
  Message,
  MessageReactions,
  MessageUser,
} from "../../types";
import { e2eService, onIdentityChange, onSenderKeyStored } from "../../crypto/e2e/e2eService";
import type { E2ECapabilityMap } from "../../crypto/e2e/types";
import { useToast } from "../../context/ToastContext";

type ToolsPanelMode = "pinned" | "search" | null;

/** Aktualizuje pola nadawcy wiadomości, gdy jego profil zmieni się na żywo. */
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

/** Mapuje kontakt DM na uproszczony profil używany przez system rozmów. */
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

/* ─── design tokens ─── */
const C = {
  bgPanel:      "var(--bg-panel)",
  border:       "var(--border)",
  textMuted:    "var(--text-muted)",
};

/* ─── Icon button with hover ─── */
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
  const resolvePresence = useResolvePresence();
  const { seed: seedPresence } = usePresenceStore();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [typingUserId, setTypingUserId] = useState<string | null>(null);
  const typingClearTimeout = useRef<ReturnType<typeof setTimeout>>();
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    messageId: string;
    preview: string;
  } | null>(null);
  const [isFriend, setIsFriend] = useState(true);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const [friendshipLoading, setFriendshipLoading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [dmError, setDmError] = useState<string | null>(null);
  const [toolsPanel, setToolsPanel] = useState<ToolsPanelMode>(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [e2eCapabilities, setE2eCapabilities] = useState<E2ECapabilityMap>({});
  const [e2ePlaintextFallback, setE2ePlaintextFallback] = useState(false);
  const [e2eConversationActive, setE2eConversationActive] = useState(false);
  const [peerFingerprint, setPeerFingerprint] = useState<string | null>(null);

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
    target.channel.members.forEach(add);
    add(target.channel.admin);
    return out;
  }, [target, currentUserId]);

  const allowMentionEveryone = target?.type === "channel";

  const channelMemberIds = useMemo(() => {
    if (target?.type !== "channel") return [];
    const seen = new Set<string>();
    const add = (id?: string) => {
      if (id) seen.add(id);
    };
    target.channel.members.forEach((member) => add(member._id));
    add(target.channel.admin?._id);
    add(currentUserId);
    return Array.from(seen);
  }, [target, currentUserId]);

  const decryptForDisplay = useCallback(
    async (list: Message[]) => {
      if (!currentUserId) return list.map(normalizeMessage);
      const normalized = list.map(normalizeMessage);
      if (!(await e2eService.canDecryptMessages())) return normalized;
      return e2eService.decryptMessages(normalized, currentUserId);
    },
    [currentUserId],
  );

  const retryFailedE2eDecrypt = useCallback(async () => {
    if (!currentUserId || target?.type !== "channel") return;
    if (!(await e2eService.canDecryptMessages())) return;
    setMessages((prev) => {
      const failed = prev.filter((m) => m.e2eEncrypted && m.e2eDecryptFailed);
      if (failed.length === 0) return prev;
      void e2eService.decryptMessages(failed, currentUserId).then((decrypted) => {
        const byId = new Map(decrypted.map((m) => [m._id, m]));
        setMessages((current) =>
          current.map((m) => {
            const next = byId.get(m._id);
            return next && !next.e2eDecryptFailed ? { ...m, ...next } : m;
          }),
        );
      });
      return prev;
    });
  }, [currentUserId, target]);

  useEffect(() => {
    if (!user?.id) return;
    e2eService.setCurrentUserId(user.id);
    void e2eService.refreshStatus();
  }, [user?.id]);

  useEffect(() => {
    return onIdentityChange(() => {
      toast.warning(t("settings.encryption.identityChanged"));
    });
  }, [t, toast]);

  useEffect(() => {
    if (!currentUserId || !e2eService.isEnabled()) {
      setE2eCapabilities({});
      setE2ePlaintextFallback(false);
      setE2eConversationActive(false);
      return;
    }

    let cancelled = false;
    const loadCaps = async () => {
      if (target?.type === "dm") {
        const cap = await e2eService.loadCapabilities([target.contact._id]);
        if (cancelled) return;
        setE2eCapabilities(cap);
        const peerReady = e2eService.peerSupportsE2e(cap, target.contact._id);
        setE2ePlaintextFallback(!peerReady);
        setE2eConversationActive(peerReady);
        if (peerReady) {
          setPeerFingerprint(cap[target.contact._id]?.fingerprint ?? null);
        } else if (!cancelled) {
          setPeerFingerprint(null);
        }
      } else if (target?.type === "channel") {
        const cap = await e2eService.loadCapabilities(channelMemberIds);
        if (cancelled) return;
        setE2eCapabilities(cap);
        setE2ePlaintextFallback(false);
        setPeerFingerprint(null);
        setE2eConversationActive(
          channelMemberIds.some(
            (id) => id !== currentUserId && e2eService.peerSupportsE2e(cap, id),
          ),
        );
      } else {
        setE2eCapabilities({});
        setE2ePlaintextFallback(false);
        setE2eConversationActive(false);
        setPeerFingerprint(null);
      }
    };

    void loadCaps();
    return () => {
      cancelled = true;
    };
  }, [target, currentUserId, channelMemberIds]);

  useEffect(() => {
    if (!ws || !user?.id || target?.type !== "channel" || !e2eService.isEnabled()) {
      return;
    }
    void e2eService.onChannelMembersChanged(
      target.channel._id,
      user.id,
      channelMemberIds,
      ws,
      e2eCapabilities,
    );
  }, [ws, user?.id, target, channelMemberIds, e2eCapabilities]);

  useEffect(() => {
    if (
      !ws ||
      !user?.id ||
      target?.type !== "channel" ||
      !e2eConversationActive
    ) {
      return;
    }
    void e2eService.requestChannelSenderKeys(
      target.channel._id,
      user.id,
      channelMemberIds,
      ws,
    );
  }, [ws, user?.id, target, channelMemberIds, e2eConversationActive]);

  useEffect(() => {
    if (target?.type !== "channel") return;
    return onSenderKeyStored((detail) => {
      if (target.channel._id !== detail.channelId) return;
      void retryFailedE2eDecrypt();
    });
  }, [target, retryFailedE2eDecrypt]);

  const loadMessages = useCallback(async () => {
    if (!target || !currentUserId) return;
    setLoading(true);
    try {
      if (target.type === "dm") {
        try {
          const { messages: list, hasMore: more } = await getMessages(
            target.contact._id,
            { limit: MESSAGE_PAGE_SIZE },
          );
          setMessages(await decryptForDisplay(list));
          setHasMore(Boolean(more));
        } catch {
          setMessages([]);
          setHasMore(false);
        }
      } else {
        const { messages: list, hasMore: more } = await getChannelMessages(
          target.channel._id,
          { limit: MESSAGE_PAGE_SIZE },
        );
        setMessages(await decryptForDisplay(list));
        setHasMore(Boolean(more));
      }
    } finally {
      setLoading(false);
    }
  }, [target, currentUserId, decryptForDisplay]);

  const loadOlderMessages = useCallback(async () => {
    if (!target || !currentUserId || loadingOlder || !hasMore) return;
    const oldest = messages[0]?._id;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const page =
        target.type === "dm"
          ? await getMessages(target.contact._id, {
              before: oldest,
              limit: MESSAGE_PAGE_SIZE,
            })
          : await getChannelMessages(target.channel._id, {
              before: oldest,
              limit: MESSAGE_PAGE_SIZE,
            });
      const older = await decryptForDisplay(page.messages);
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m._id));
        const merged = older.filter((m) => !existing.has(m._id));
        return merged.length > 0 ? [...merged, ...prev] : prev;
      });
      setHasMore(Boolean(page.hasMore));
    } catch {
      // Zostaw hasMore bez zmian — użytkownik może ponowić próbę.
    } finally {
      setLoadingOlder(false);
    }
  }, [target, currentUserId, messages, hasMore, loadingOlder, decryptForDisplay]);

  useEffect(() => {
    setMessages([]);
    setHasMore(false);
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
    loadMessages();
  }, [loadMessages]);

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

    setIsBlockedByMe(Boolean(target.contact.isBlockedByMe));
    let cancelled = false;
    setFriendshipLoading(true);
    checkFriendship(target.contact._id)
      .then((res) => {
        if (!cancelled) {
          setIsFriend(res.isFriend);
          setIsBlockedByMe(Boolean(res.isBlockedByMe));
          setIsBlockedByOther(Boolean(res.isBlockedByOther));
        }
      })
      .catch(() => {
        if (!cancelled) setIsFriend(false);
      })
      .finally(() => {
        if (!cancelled) setFriendshipLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [target?.type === "dm" ? target.contact._id : null]);

  useEffect(() => {
    if (!ws || !user || target?.type !== "dm" || loading || !canSendDm) return;

    ws.send(WsType.MARK_CONVERSATION_READ, {
      userId: user.id,
      contactId: target.contact._id,
    });
  }, [
    ws,
    user,
    target?.type === "dm" ? target.contact._id : null,
    loading,
    canSendDm,
  ]);

  useEffect(() => {
    if (!ws || !user || target?.type !== "channel" || loading) return;

    ws.send(WsType.MARK_CHANNEL_READ, {
      userId: user.id,
      channelId: target.channel._id,
    });
  }, [
    ws,
    user,
    target?.type === "channel" ? target.channel._id : null,
    loading,
  ]);

  useEffect(() => {
    if (!ws || !target) return;

    const appendMessage = (msg: Message) => {
      void (async () => {
        const decrypted = await decryptForDisplay([msg]);
        const next = decrypted[0];
        if (!next) return;
        setMessages((prev) => {
          if (prev.some((m) => m._id === next._id)) return prev;
          return [...prev, next];
        });
      })();
    };

    const onDm = (msg: Message) => {
      if (target.type !== "dm") return;
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
          ws.send(WsType.MARK_MESSAGE_READ, {
            messageId: msg._id,
            userId: currentUserId,
          });
        }
      }
    };

    const onChannel = (msg: Message & { channelId?: string }) => {
      if (target.type !== "channel") return;
      const chId = msg.channelId ?? msg.channel;
      if (chId === target.channel._id) {
        appendMessage(msg);

        ws.send(WsType.MARK_CHANNEL_READ, {
          userId: currentUserId,
          channelId: target.channel._id,
        });
      }
    };

    const onEdited = (msg: Message) => {
      void (async () => {
        const decrypted = await decryptForDisplay([msg]);
        const next = decrypted[0];
        if (!next) return;
        setMessages((prev) =>
          prev.map((m) => (m._id === next._id ? { ...m, ...next } : m)),
        );
      })();
    };

    const onReaction = (data: {
      messageId: string;
      reactions: MessageReactions;
      channelId?: string;
    }) => {
      if (target.type === "channel") {
        if (data.channelId && data.channelId !== target.channel._id) return;
      }

      setMessages((prev) => {
        const exists = prev.some((m) => m._id === data.messageId);
        if (!exists) return prev;

        return prev.map((m) =>
          m._id === data.messageId
            ? { ...m, reactions: normalizeReactions(data.reactions) }
            : m,
        );
      });
    };

    const onDeleted = (data: { _id: string }) => {
      setMessages((prev) => prev.filter((m) => m._id !== data._id));
    };

    const onMessageRead = (data: { messageId: string; read: boolean }) => {
      if (target.type !== "dm") return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === data.messageId ? { ...m, read: data.read } : m,
        ),
      );
    };

    const onMessagesRead = (data: {
      messageIds: string[];
      read: boolean;
      readerId: string;
    }) => {
      if (target.type !== "dm") return;
      if (data.readerId !== target.contact._id) return;

      const ids = new Set(data.messageIds);
      setMessages((prev) =>
        prev.map((m) => (ids.has(m._id) ? { ...m, read: data.read } : m)),
      );
    };

    const applyTyping = (userId: string | null, isTyping: boolean) => {
      if (typingClearTimeout.current) {
        clearTimeout(typingClearTimeout.current);
        typingClearTimeout.current = undefined;
      }
      if (isTyping && userId) {
        setTypingUserId(userId);
        // Fallback: if the peer's "stopped" event is ever dropped, clear the
        // indicator automatically so it can never get stuck on-screen.
        typingClearTimeout.current = setTimeout(
          () => setTypingUserId(null),
          6000,
        );
      } else {
        setTypingUserId(null);
      }
    };

    const onTyping = (data: { chatId: string; userId: string; isTyping: boolean }) => {
      if (target.type === "dm") {
        if (data.userId === target.contact._id)
          applyTyping(data.userId, data.isTyping);
      } else if (
        data.chatId === `channel_${target.channel._id}` &&
        data.userId !== currentUserId
      ) {
        applyTyping(data.userId, data.isTyping);
      }
    };

    const onDmError = (data: { code?: string; message?: string }) => {
      if (data.code === "NOT_FRIENDS" && data.message) {
        setDmError(data.message);
        setIsFriend(false);
      }
      if (data.code === "USER_BLOCKED" && data.message) {
        setDmError(data.message);
        setIsBlockedByMe(true);
      }
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
    ];

    return () => unsubs.forEach((u) => u());
  }, [ws, target, currentUserId, decryptForDisplay]);

  useProfileSync(ws, {
    onInfo: ({ userId, username, displayName, bio, color }) =>
      setMessages((prev) =>
        prev.map((m) =>
          patchMessageSender(m, userId, {
            username: username ?? undefined,
            displayName: displayName ?? undefined,
            bio: bio ?? undefined,
            color: color ?? undefined,
          }),
        ),
      ),
    onImage: ({ userId, image }) =>
      setMessages((prev) =>
        prev.map((m) => patchMessageSender(m, userId, { image })),
      ),
    onBanner: ({ userId, banner }) =>
      setMessages((prev) =>
        prev.map((m) => patchMessageSender(m, userId, { banner })),
      ),
  });

  const mustEncryptOutgoing = useCallback((): boolean => {
    return e2eService.isEnabled() && e2eConversationActive;
  }, [e2eConversationActive]);

  const loadE2eCapabilities = useCallback(async (): Promise<E2ECapabilityMap> => {
    if (!target) return {};
    if (Object.keys(e2eCapabilities).length > 0) return e2eCapabilities;
    if (target.type === "dm") {
      return e2eService.loadCapabilities([target.contact._id]);
    }
    return e2eService.loadCapabilities(channelMemberIds);
  }, [target, e2eCapabilities, channelMemberIds]);

  const encryptOutgoingText = useCallback(
    async (
      plaintext: string,
      force = false,
    ): Promise<{ content: string; e2eEncrypted?: boolean; e2eVersion?: number }> => {
      if (!target || !user) return { content: plaintext };
      if (!e2eService.isEnabled() && !force) return { content: plaintext };

      try {
        const cap = await loadE2eCapabilities();
        if (target.type === "dm") {
          if (force || e2eService.shouldEncryptDm(target.contact._id, cap)) {
            return e2eService.encryptOutgoingDm(target.contact._id, plaintext);
          }
        } else {
          const encrypted = await e2eService.encryptOutgoingChannel(
            target.channel._id,
            user.id,
            plaintext,
            channelMemberIds,
            ws,
            cap,
          );
          if (encrypted) return encrypted;
        }
      } catch {
        if (mustEncryptOutgoing() || force) {
          throw new Error("E2E_ENCRYPT_FAILED");
        }
      }

      if (mustEncryptOutgoing() || force) {
        throw new Error("E2E_ENCRYPT_FAILED");
      }
      return { content: plaintext };
    },
    [target, user, ws, channelMemberIds, loadE2eCapabilities, mustEncryptOutgoing],
  );

  const prepareEncryptedUpload = useCallback(
    async (file: File) => {
      if (!target || !user || !e2eService.isEnabled()) return null;
      const cap = await loadE2eCapabilities();
      const encryptedPack =
        target.type === "dm"
          ? await e2eService.encryptOutgoingAttachment(
              { kind: "dm", peerId: target.contact._id, cap },
              file,
            )
          : await e2eService.encryptOutgoingAttachment(
              {
                kind: "channel",
                channelId: target.channel._id,
                senderId: user.id,
                memberIds: channelMemberIds,
                cap,
                ws,
              },
              file,
            );

      if (!encryptedPack) {
        if (mustEncryptOutgoing()) throw new Error("E2E_ENCRYPT_FAILED");
        return null;
      }

      return {
        uploadFile: new File([encryptedPack.encryptedFile], `${file.name}.e2e`, {
          type: "application/octet-stream",
        }),
        e2eFields: encryptedPack.wsPayload,
        displayFileName: file.name,
        displayFileType: file.type || "application/octet-stream",
      };
    },
    [target, user, ws, channelMemberIds, loadE2eCapabilities, mustEncryptOutgoing],
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

      let e2eFields: { e2eEncrypted?: boolean; e2eVersion?: number } = {};
      let uploadFileObj = file;
      let displayFileName = file.name;
      let displayFileType = file.type || "application/octet-stream";

      try {
        const encrypted = await prepareEncryptedUpload(file);
        if (encrypted) {
          uploadFileObj = encrypted.uploadFile;
          e2eFields = encrypted.e2eFields;
          displayFileName = encrypted.displayFileName;
          displayFileType = encrypted.displayFileType;
        }
      } catch (error) {
        if (error instanceof Error && error.message === "E2E_ENCRYPT_FAILED") {
          toast.error(t("chat.window.e2eEncryptFailed"));
          return;
        }
        if (mustEncryptOutgoing()) {
          toast.error(t("chat.window.e2eEncryptFailed"));
          return;
        }
      }

      const { filePath } = await uploadFile(uploadFileObj, uploadContext);
      const payload = {
        sender: user.id,
        content:
          options?.content ?? (messageType === "AUDIO" ? "" : displayFileName),
        messageType,
        fileUrl: filePath,
        fileName: displayFileName,
        fileType: displayFileType,
        fileSize: file.size,
        ...(options?.durationMs != null ? { durationMs: options.durationMs } : {}),
        ...quotePayload,
        ...e2eFields,
      };

      if (target.type === "dm") {
        ws.send(WsType.SEND_MESSAGE, { ...payload, recipient: target.contact._id });
      } else {
        ws.send(WsType.SEND_CHANNEL_MESSAGE, { ...payload, channelId: target.channel._id });
      }
      setReplyingTo(null);
    },
    [
      ws,
      target,
      user,
      canSendDm,
      replyingTo,
      prepareEncryptedUpload,
      mustEncryptOutgoing,
      toast,
      t,
    ],
  );

  const sendRemoteMediaMessage = useCallback(
    async (
      mediaUrl: string,
      title: string,
      fileType: string,
      messageType: "IMAGE" | "STICKER",
    ) => {
      if (!isAllowedGifMediaUrl(mediaUrl) && !mediaUrl.startsWith("https://")) return;
      try {
        const response = await fetch(mediaUrl);
        if (!response.ok) throw new Error("FETCH_FAILED");
        const blob = await response.blob();
        const file = new File([blob], title || "media", {
          type: fileType || blob.type || "application/octet-stream",
        });
        await sendFileMessage(file, { messageType, content: title });
      } catch {
        toast.error(t("chat.window.e2eEncryptFailed"));
      }
    },
    [sendFileMessage, toast, t],
  );

  const sendMessage = async (content: string) => {
    if (!ws || !target || !user || !canSendDm) return;
    if (editingMessage) {
      try {
        const forceEncrypt = Boolean(editingMessage.e2eEncrypted);
        const encrypted = await encryptOutgoingText(content, forceEncrypt);
        ws.send(WsType.EDIT_MESSAGE, {
          messageId: editingMessage._id,
          content: encrypted.content,
          userId: user.id,
          ...(encrypted.e2eEncrypted
            ? {
                e2eEncrypted: encrypted.e2eEncrypted,
                e2eVersion: encrypted.e2eVersion,
              }
            : {}),
        });
      } catch {
        toast.error(t("chat.window.e2eEncryptFailed"));
        return;
      }
      setEditingMessage(null);
      return;
    }

    const quotedMessage = replyingTo?._id;
    const quotePayload = quotedMessage ? { quotedMessage } : {};
    const externalMedia = resolveSingleExternalMediaSend(content);

    if (externalMedia && mustEncryptOutgoing()) {
      await sendRemoteMediaMessage(
        externalMedia.url,
        externalMedia.fileName,
        externalMedia.fileType,
        "IMAGE",
      );
      return;
    }

    let e2eFields: { e2eEncrypted?: boolean; e2eVersion?: number } = {};
    let outboundContent = content;

    if (!externalMedia) {
      try {
        const encrypted = await encryptOutgoingText(content);
        outboundContent = encrypted.content;
        if (encrypted.e2eEncrypted) {
          e2eFields = {
            e2eEncrypted: encrypted.e2eEncrypted,
            e2eVersion: encrypted.e2eVersion,
          };
        }
      } catch {
        toast.error(t("chat.window.e2eEncryptFailed"));
        return;
      }
    }

    const payload = externalMedia
      ? {
          sender: user.id,
          content: externalMedia.fileName,
          messageType: "IMAGE" as const,
          fileUrl: externalMedia.url,
          fileName: externalMedia.fileName,
          fileType: externalMedia.fileType,
          ...quotePayload,
        }
      : {
          sender: user.id,
          content: outboundContent,
          messageType: "TEXT" as const,
          ...quotePayload,
          ...e2eFields,
        };

    if (target.type === "dm") {
      ws.send(WsType.SEND_MESSAGE, {
        ...payload,
        recipient: target.contact._id,
      });
    } else {
      ws.send(WsType.SEND_CHANNEL_MESSAGE, {
        ...payload,
        channelId: target.channel._id,
      });
    }

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

  const handleGif = async (gifUrl: string, gifTitle: string) => {
    if (!ws || !target || !user || !canSendDm) return;
    await sendRemoteMediaMessage(gifUrl, gifTitle, "image/gif", "IMAGE");
  };

  const handleSticker = async (stickerUrl: string, stickerTitle: string) => {
    if (!ws || !target || !user || !canSendDm) return;
    await sendRemoteMediaMessage(stickerUrl, stickerTitle, "image/gif", "STICKER");
  };

  const handleReaction = (messageId: string, emoji: string) => {
    if (!ws || !currentUserId || !canReact) return;

    setMessages((prev) =>
      prev.map((m) =>
        m._id === messageId
          ? {
              ...m,
              reactions: toggleReactionLocal(m.reactions, emoji, currentUserId),
            }
          : m,
      ),
    );

    ws.send(WsType.MESSAGE_REACTION, {
      messageId,
      emoji,
    });
  };

  const handleDelete = (message: Message) => {
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
    setReplyingTo(null);
    setEditingMessage(message);
  };

  const handleReply = (message: Message) => {
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
    if (!deleteConfirm) return;
    ws?.send(WsType.DELETE_MESSAGE, {
      messageId: deleteConfirm.messageId,
      userId: currentUserId,
    });
  };

  const applyMessageUpdate = (updated: Message) => {
    setMessages((prev) =>
      prev.map((m) =>
        m._id === updated._id ? normalizeMessage({ ...m, ...updated }) : m,
      ),
    );
  };

  const handlePin = async (message: Message) => {
    try {
      const { message: updated } = await pinMessageHttp(message._id);
      applyMessageUpdate(updated);
    } catch {
      /* ignore */
    }
  };

  const handleUnpin = async (message: Message) => {
    try {
      const { message: updated } = await unpinMessageHttp(message._id);
      applyMessageUpdate(updated);
    } catch {
      /* ignore */
    }
  };

  const handleJumpToMessage = (messageId: string) => {
    setToolsPanel(null);
    setHighlightMessageId(messageId);
    requestAnimationFrame(() => {
      const el = document.querySelector(
        `.message-list [data-message-id="${messageId}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    window.setTimeout(() => setHighlightMessageId(null), 2500);
  };

  /* ── Empty / welcome screen ─────────────────────────────────────────── */
  if (!target) {
    return (
      <div className="chat-window chat-window--empty">
        <p className="chat-window__empty-hint">{t("chat.empty.selectChat")}</p>
      </div>
    );
  }

  /* ── Active chat ─────────────────────────────────────────────────────── */
  const dmContact =
    target.type === "dm" ? resolvePresence(target.contact) : null;
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
        {/* ── Left: avatar + name ── */}
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
          {target.type === "dm" && e2eConversationActive ? (
            <span
              className="chat-header__desc"
              title={
                peerFingerprint
                  ? t("chat.window.e2ePeerFingerprint", {
                      fingerprint: peerFingerprint,
                    })
                  : t("chat.window.e2eActive")
              }
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              {peerFingerprint
                ? `${t("chat.window.e2eActive")} · ${peerFingerprint.slice(0, 8)}…`
                : t("chat.window.e2eActive")}
            </span>
          ) : null}
          {target.type === "channel" && target.channel.description && (
            <span className="chat-header__desc">{target.channel.description}</span>
          )}
        </div>

        {/* ── Right: action buttons ── */}
        <div className="chat-header__actions">

          {/* grouped pill toolbar */}
          <div className="chat-header__toolbar">
            {/* Phone (DM ze znajomym) */}
            {target.type === "dm" && canSendDm && (
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

            {/* Voice channel (kanał) */}
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

            {/* Video (tylko DM ze znajomym) */}
            {target.type === "dm" && canSendDm && (
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

            {/* Pin */}
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

            {/* Search */}
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

            {/* Channel settings */}
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

            {/* Profile (DM only) */}
            {target.type === "dm" && (
              <IconBtn title={t("chat.window.contactProfile")} onClick={() => setProfileOpen(true)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </IconBtn>
            )}
            {/* separator */}
            <div className="chat-header__toolbar-sep" aria-hidden="true" />

            {/* Close */}
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
          <ChatToolsPanel
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
      ) : target.type === "channel" && isChannelChatLocked ? (
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
        <>
          {target.type === "dm" && e2ePlaintextFallback && e2eService.isEnabled() ? (
            <div
              style={{
                padding: "10px 18px",
                borderTop: `1px solid ${C.border}`,
                background: C.bgPanel,
                color: C.textMuted,
                fontSize: "0.82rem",
                lineHeight: 1.5,
                textAlign: "center",
                fontFamily: "var(--font-sans)",
              }}
            >
              {t("chat.window.e2eFallback")}
            </div>
          ) : null}
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
            disabled={!canSendChannel || !wsConnected}
            placeholder={
              editingMessage
                ? t("chat.input.editPlaceholder")
                : replyingTo
                  ? t("chat.input.replyPlaceholder")
                : friendshipLoading
                  ? t("chat.input.checkingPermissions")
                  : target.type === "channel"
                    ? t("chat.input.channelPlaceholder", { channel: target.channel.name })
                    : t("chat.input.dmPlaceholder", { name: userLabel(target.contact) })
            }
            initialText={editingMessage?.content ?? ""}
            isEditing={Boolean(editingMessage)}
            onCancelEdit={handleCancelEdit}
            replyTo={replyingTo}
            onCancelReply={handleCancelReply}
            mentionCandidates={mentionCandidates}
            allowMentionEveryone={allowMentionEveryone}
          />
        </>
      )}

      {target.type === "dm" && (
        <OtherUserProfileModal
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

      <DeleteMessageModal
        isOpen={Boolean(deleteConfirm)}
        preview={deleteConfirm?.preview ?? ""}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirm(null)}
      />

      {lightboxIndex !== null && imageLightboxItems.length > 0 && (
        <ImageLightbox
          items={imageLightboxItems}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}