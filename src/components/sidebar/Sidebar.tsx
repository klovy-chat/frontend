// Sidebar.tsx
// Lista kontaktów i kanałów + live unread/mute/tip z HTTP i WS.
// Zakres:
//  - merge snapshotu z deltami
//  - sticky-0 po mark-read
//  - menu, tworzenie kanału
// To najczulszy plik listy — zmiana unread bez UnreadSync/markRead psuje badge w Settings.
// Przy zmianach: UnreadSync.tsx, unread.ts, muted.ts, preview.ts.

import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getContactsForList, searchContacts, toggleContactMute, toggleContactBlock } from "../../api/contacts";
import { removeFriend } from "../../api/friends";
import {
  getUserChannels,
  getChannelDetails,
  createChannel,
  renameChannel,
  uploadChannelAvatar,
  deleteChannel,
  toggleChannelMute,
} from "../../api/channels";
import { useAuth } from "../../context/AuthContext";
import { usePresenceSeed, getPresenceSnapshot } from "../../context/PresenceContext";
import { invalidateFriendshipCache } from "../../utils/chat/friendsCache";
import { useToast } from "../../context/ToastContext";
import { useWebSocket, useWebSocketConnected } from "../../context/WebSocketContext";
import {
  channelCacheKey,
  dmCacheKey,
  removeMessagePageCache,
  staleAllMessagePageCaches,
} from "../../utils/chat/messageCache";
import { WsType } from "../../api/protocol";
import { Avatar } from "../common/Avatar";
import unreadSync from "../../utils/sync/unread";
import {
  getMutedConversationKeys,
  isConversationMuted,
  mergeMutedFromHttp,
  setMutedConversationKeys,
  subscribeMutedConversations,
} from "../../utils/sync/muted";
import {
  ackPendingMarkReadByKey,
  peekPendingMarkReadKeys,
  subscribePendingMarkReads,
} from "../../utils/sync/markRead";
import {
  getActiveConversationKey,
  subscribeActiveConversation,
} from "../../utils/sync/activeChat";
import {
  addMentionSource,
  clearMentionSource,
  getMentionSources,
  subscribeMentionSources,
} from "../../utils/sync/mentions";
import { playNotificationSound } from "../../utils/media/notifySound";
import { settingsPath } from "../../settings/routes";
import { Nav } from "../layout/Nav";
import { ChatList, type ChatListTab } from "../layout/ChatList";
import { MyProfile } from "../profile/MyProfile";
import { OtherProfile } from "../profile/OtherProfile";
import { userLabel, availabilityStatusLabel } from "../../utils/user/format";
import { channelMemberCount, channelMemberCountLabel, getEffectiveStatus } from "../../utils/user/presence";
import {
  patchChannelsFromEditedMessage,
  patchChannelsFromMessage,
  patchChannelsOnMessageDeleted,
  patchContactsFromEditedMessage,
  patchContactsFromMessage,
  patchContactsOnMessageDeleted,
  subscribeSidebarTipFromMessage,
  subscribeSidebarTipRevert,
  tipIdNewerPreferNonTemp,
} from "../../utils/chat/preview";
import { useProfileSync } from "../../hooks/useProfileSync";
import type { Channel, ChatTarget, Contact, Message } from "../../types";
import { ChannelSettings } from "../channel/ChannelSettings";
import { Contacts } from "../contacts/Contacts";
import { ImageCrop } from "../common/ImageCrop";
import {
  MAX_AVATAR_SIZE_BYTES,
  MAX_AVATAR_SIZE_LABEL,
} from "../../constants/upload";
import {
  bumpPublicMediaCache,
  bumpPublicMediaCacheForChannel,
} from "../../utils/media/cdnVersion";
import "../../styles/chat/menu.css";

const C = {
  bgDeep:    "var(--bg-deep)",
  bgPanel:   "var(--bg-panel)",
  bgHover:   "var(--bg-hover)",
  border:    "var(--border)",
  borderLight: "var(--border-light)",
  text:      "var(--text)",
  textMuted: "var(--text-muted)",
  textDim:   "var(--text-dim)",
  accent:    "var(--accent)",
  accentHover: "var(--accent-hover)",
  accentDim: "var(--accent-dim)",
  accentBorder: "var(--accent-border)",
  danger:    "var(--danger)",
  dangerDim: "var(--danger-dim)",
  dangerBorder: "var(--danger-border)",
};

const modalCard: React.CSSProperties = {
  background: C.bgPanel,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: "0 32px 80px rgba(0,0,0,0.65)",
  width: 440, maxWidth: "95vw",
  overflow: "hidden",
};

const modalHeader: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", justifyContent: "space-between",
  padding: "24px 24px 0",
};

const modalTitle: React.CSSProperties = {
  margin: 0, fontSize: "1.05rem", fontWeight: 700, color: C.text,
  letterSpacing: "-0.01em",
};

const modalSubtitle: React.CSSProperties = {
  margin: "4px 0 0", fontSize: "0.8rem", color: C.textMuted, lineHeight: 1.5,
};

const modalBody: React.CSSProperties = {
  padding: "20px 24px",
};

const modalFooter: React.CSSProperties = {
  padding: "0 24px 22px",
  display: "flex", justifyContent: "flex-end", gap: 10,
};

const closeBtn: React.CSSProperties = {
  width: 32, height: 32,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "none", cursor: "pointer",
  color: C.textMuted, fontSize: "1.3rem", lineHeight: 1,
  borderRadius: 8, flexShrink: 0,
  transition: "color 0.15s, background 0.15s",
};

const fieldLabel: React.CSSProperties = {
  display: "block", marginBottom: 8,
  fontSize: "0.7rem", fontWeight: 700,
  letterSpacing: "0.1em", textTransform: "uppercase",
  color: C.textMuted,
};

const textInput: React.CSSProperties = {
  width: "100%",
  background: C.bgDeep,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  padding: "11px 14px",
  color: C.text, fontSize: "0.875rem",
  outline: "none",
  transition: "border-color 0.18s, background 0.18s",
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 22px",
  background: C.accent, border: "none", borderRadius: 8,
  fontSize: "0.85rem", fontWeight: 700, color: "#fff",
  cursor: "pointer", transition: "background 0.15s",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 18px",
  background: "transparent", border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: "0.85rem", fontWeight: 600,
  color: C.textMuted, cursor: "pointer", transition: "background 0.15s, color 0.15s",
};

const btnDanger: React.CSSProperties = {
  padding: "10px 22px",
  background: C.danger, border: "none", borderRadius: 8,
  fontSize: "0.85rem", fontWeight: 700, color: "#fff",
  cursor: "pointer", transition: "background 0.15s",
};

function HoverBtn({
  style, hoverStyle, children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { hoverStyle?: React.CSSProperties }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      style={{ ...style, ...(hovered ? hoverStyle : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      {...props}
    >
      {children}
    </button>
  );
}

interface SidebarProps {
  active: ChatTarget | null;
  onSelect: (target: ChatTarget | null) => void;
  children: React.ReactNode;
}

interface MentionFrom {
  id?: string;
  username?: string;
  displayName?: string | null;
  image?: string | null;
  color?: number;
}

interface MentionEvent {
  scope: "dm" | "channel";
  sourceId: string;
  sourceName?: string;
  messageId: string;
  from?: MentionFrom;
  preview?: string;
}

interface MentionToast extends MentionEvent {
  key: number;
}

export function Sidebar({ active, onSelect, children }: SidebarProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const toast = useToast();
  const ws = useWebSocket();
  const wsConnected = useWebSocketConnected();
  const seedPresence = usePresenceSeed();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);

  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const currentUserIdRef = useRef(user?.id);
  currentUserIdRef.current = user?.id;

  const availabilityRef = useRef(user?.availabilityStatus);
  availabilityRef.current = user?.availabilityStatus;

  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Contact[]>([]);

  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelClosing, setNewChannelClosing] = useState(false);
  const [channelName, setChannelName] = useState("");

  const [contextMenu, setContextMenu] = useState<{
    kind: "dm" | "channel";
    id: string;
    name: string;
    subtitle: string;
    isMuted: boolean;
    x: number;
    y: number;
    contact?: Contact;
    channel?: Channel;
  } | null>(null);

  const [renameChannelInfo, setRenameChannelInfo] = useState<{ channelId: string; channelName: string } | null>(null);
  const [renameChannelClosing, setRenameChannelClosing] = useState(false);
  const [renameChannelName, setRenameChannelName] = useState("");

  const [deleteChannelInfo, setDeleteChannelInfo] = useState<{ channelId: string; channelName: string } | null>(null);
  const [deleteChannelClosing, setDeleteChannelClosing] = useState(false);

  const [uploadAvatarChannel, setUploadAvatarChannel] = useState<{ channelId: string; channelName: string } | null>(null);
  const [channelCropFile, setChannelCropFile] = useState<File | null>(null);
  const [channelAvatarUploading, setChannelAvatarUploading] = useState(false);

  const [channelSettingsInfo, setChannelSettingsInfo] = useState<{
    channelId: string; channelName: string; channel: Channel;
  } | null>(null);

  const navigate = useNavigate();
  const [chatListTab, setChatListTab] = useState<ChatListTab>("dm");
  const [profileOpen, setProfileOpen] = useState(false);
  const [contactProfileOpen, setContactProfileOpen] = useState(false);
  const [contactProfile, setContactProfile] = useState<Contact | null>(null);
  const [contactProfileOpenKey, setContactProfileOpenKey] = useState(0);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [contactsModalClosing, setContactsModalClosing] = useState(false);
  const [removeContactInfo, setRemoveContactInfo] = useState<Contact | null>(null);
  const [removeContactClosing, setRemoveContactClosing] = useState(false);
  const [removeContactSending, setRemoveContactSending] = useState(false);
  const mentionSources = useSyncExternalStore(
    subscribeMentionSources,
    getMentionSources,
    getMentionSources,
  );
  const [mentionToast, setMentionToast] = useState<MentionToast | null>(null);

  const [pendingMarkEpoch, setPendingMarkEpoch] = useState(0);
  const mentionToastTimeout = useRef<ReturnType<typeof setTimeout>>();

  const channelInputRef = useRef<HTMLInputElement>(null);
  const channelAvatarInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const rosterDirtyDuringRefreshRef = useRef(false);
  const refreshDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const rosterDetailsDebounceRef = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const activeRef = useRef(active);
  activeRef.current = active;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const channelSettingsInfoRef = useRef(channelSettingsInfo);
  channelSettingsInfoRef.current = channelSettingsInfo;
  const renameChannelInfoRef = useRef(renameChannelInfo);
  renameChannelInfoRef.current = renameChannelInfo;
  const deleteChannelInfoRef = useRef(deleteChannelInfo);
  deleteChannelInfoRef.current = deleteChannelInfo;
  const contactProfileRef = useRef(contactProfile);
  contactProfileRef.current = contactProfile;
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const unreadRevisionRef = useRef(new Map<string, number>());
  const unreadGenerationRef = useRef(new Map<string, number>());

  const rawUnreadRef = useRef(new Map<string, number>());

  const dirtyUnreadDuringRefreshRef = useRef(new Set<string>());

  const ignoreUnreadDeltasUntilRef = useRef(0);

  const contactsSnapshotRef = useRef<Contact[]>([]);
  const channelsSnapshotRef = useRef<Channel[]>([]);

  const wipedUnreadKeysRef = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const run = (async () => {
      let mergeOk = false;
      try {

        ignoreUnreadDeltasUntilRef.current = Number.POSITIVE_INFINITY;
        rosterDirtyDuringRefreshRef.current = false;
        const gensAtStart = new Map(unreadGenerationRef.current);
        const [contactsRes, channelsRes] = await Promise.all([
          getContactsForList(),
          getUserChannels(),
        ]);

        const prevContacts = new Map(
          contactsSnapshotRef.current.map((c) => [c._id, c]),
        );
        const prevChannels = new Map(
          channelsSnapshotRef.current.map((ch) => [ch._id, ch]),
        );

        {
          const rosterIds: string[] = [];
          const httpMuted: string[] = [];
          for (const c of contactsRes.contacts ?? []) {
            const key = `dm:${c._id}`;
            rosterIds.push(key);
            if (c.isMuted) httpMuted.push(key);
          }
          for (const ch of channelsRes.channels ?? []) {
            const key = `channel:${ch._id}`;
            rosterIds.push(key);
            if (ch.isMuted) httpMuted.push(key);
          }

          const mutedBefore = new Set(getMutedConversationKeys());
          mergeMutedFromHttp(httpMuted, rosterIds);
          const dirty = dirtyUnreadDuringRefreshRef.current;
          for (const key of mutedBefore) {
            const kind = key.startsWith("dm:") ? "dm" : "channel";
            const id = key.slice(key.indexOf(":") + 1);
            if (!isConversationMuted(kind, id)) dirty.delete(key);
          }
        }
        const current = activeRef.current;
        const dirty = dirtyUnreadDuringRefreshRef.current;
        const nextRaw = new Map<string, number>();
        const pendingZeroKeys = new Set(peekPendingMarkReadKeys());
        const tipNewer = (
          liveTime?: string,
          liveId?: string,
          httpTime?: string,
          httpId?: string,
        ) => {

          if (!liveId && liveTime == null) return false;
          const lt = liveTime ? Date.parse(liveTime) : NaN;
          const ht = httpTime ? Date.parse(httpTime) : NaN;
          if (Number.isFinite(lt) && Number.isFinite(ht)) {

            if (
              liveId?.startsWith("temp-") &&
              httpId &&
              !httpId.startsWith("temp-")
            ) {
              return false;
            }
            if (lt > ht) return true;
            if (lt < ht) return false;

            return tipIdNewerPreferNonTemp(liveId, httpId);
          }

          return false;
        };
        setContacts(() =>
          contactsRes.contacts.map((c) => {
            const key = `dm:${c._id}`;

            const muted = isConversationMuted("dm", c._id);
            const preferLiveUnread =
              dirty.has(key) ||
              (unreadGenerationRef.current.get(key) ?? 0) >
                (gensAtStart.get(key) ?? 0);
            const pendingZero = pendingZeroKeys.has(key);
            const httpN = Math.max(0, c.unreadCount ?? 0);
            const live = preferLiveUnread
              ? rawUnreadRef.current.get(key)
              : undefined;

            const raw = muted || pendingZero
              ? 0
              : live !== undefined
                ? live === 0 && preferLiveUnread
                  ? 0
                  : Math.max(httpN, live)
                : httpN;
            nextRaw.set(key, raw);
            const unreadCount =
              current?.type === "dm" && current.contact._id === c._id
                ? 0
                : raw;
            const prev = prevContacts.get(c._id);
            const keepTip =
              prev &&
              tipNewer(
                prev.lastMessageTime,
                prev.lastMessageId,
                c.lastMessageTime,
                c.lastMessageId,
              );
            return {
              ...c,
              isMuted: muted,
              ...(keepTip
                ? {
                    lastMessage: prev.lastMessage,
                    lastMessageTime: prev.lastMessageTime,
                    lastMessageId: prev.lastMessageId,
                  }
                : {}),
              unreadCount,
            };
          }),
        );
        setChannels(() =>
          channelsRes.channels.map((ch) => {
            const key = `channel:${ch._id}`;
            const muted = isConversationMuted("channel", ch._id);
            const preferLiveUnread =
              dirty.has(key) ||
              (unreadGenerationRef.current.get(key) ?? 0) >
                (gensAtStart.get(key) ?? 0);
            const pendingZero = pendingZeroKeys.has(key);
            const httpN = Math.max(0, ch.unreadCount ?? 0);
            const live = preferLiveUnread
              ? rawUnreadRef.current.get(key)
              : undefined;
            const raw = muted || pendingZero
              ? 0
              : live !== undefined
                ? live === 0 && preferLiveUnread
                  ? 0
                  : Math.max(httpN, live)
                : httpN;
            nextRaw.set(key, raw);
            const unreadCount =
              current?.type === "channel" && current.channel._id === ch._id
                ? 0
                : raw;
            const prev = prevChannels.get(ch._id);
            const keepTip =
              prev &&
              tipNewer(
                prev.lastMessageTime,
                prev.lastMessageId,
                ch.lastMessageTime,
                ch.lastMessageId,
              );
            return {
              ...ch,
              isMuted: muted,
              ...(keepTip
                ? {
                    lastMessage: prev.lastMessage,
                    lastMessageTime: prev.lastMessageTime,
                    lastMessageId: prev.lastMessageId,
                  }
                : {}),
              unreadCount,
            };
          }),
        );
        rawUnreadRef.current = nextRaw;
        for (const c of contactsRes.contacts ?? []) {
          wipedUnreadKeysRef.current.delete(`dm:${c._id}`);
        }
        seedPresence(contactsRes.contacts);

        if (current?.type === "dm") {
          const fresh = contactsRes.contacts.find(
            (c) => c._id === current.contact._id,
          );
          if (!fresh) {
            onSelect(null);
          } else {
            const cur = current.contact;
            const storeMuted = isConversationMuted("dm", fresh._id);
            const needsSync =
              cur.displayName !== fresh.displayName ||
              cur.username !== fresh.username ||
              cur.image !== fresh.image ||
              cur.color !== fresh.color ||
              Boolean(cur.isMuted) !== storeMuted;
            if (needsSync) {
              onSelect({
                type: "dm",
                contact: {
                  ...fresh,
                  isMuted: storeMuted,
                  unreadCount: 0,
                },
              });
            }
          }
        } else if (current?.type === "channel") {
          const fresh = channelsRes.channels.find(
            (ch) => ch._id === current.channel._id,
          );
          if (!fresh) {
            onSelect(null);
            setChannelSettingsInfo(null);
            setRenameChannelInfo(null);
            setDeleteChannelInfo(null);
          } else {
            const cur = current.channel;
            const storeMuted = isConversationMuted("channel", fresh._id);
            const needsSync =
              cur.name !== fresh.name ||
              cur.image !== fresh.image ||
              cur.rateLimitPerUser !== fresh.rateLimitPerUser ||
              cur.chatLocked !== fresh.chatLocked ||
              cur.isMutedHere !== fresh.isMutedHere ||
              cur.mutedHereExpiresAt !== fresh.mutedHereExpiresAt ||
              Boolean(cur.isMuted) !== storeMuted ||
              cur.memberCount !== fresh.memberCount ||
              (cur.members?.length ?? 0) !== (fresh.members?.length ?? 0) ||
              (cur.members ?? [])
                .map((m) => m._id)
                .sort()
                .join(",") !==
                (fresh.members ?? [])
                  .map((m) => m._id)
                  .sort()
                  .join(",");
            if (needsSync) {
              onSelect({
                type: "channel",
                channel: {
                  ...fresh,
                  isMuted: storeMuted,
                  unreadCount: 0,
                },
              });
            }
          }
        }

        dirtyUnreadDuringRefreshRef.current.clear();
        mergeOk = true;
      } catch {

        ignoreUnreadDeltasUntilRef.current = Number.POSITIVE_INFINITY;
        window.setTimeout(() => {
          void refresh();
        }, 750);
      } finally {
        if (mergeOk) {
          ignoreUnreadDeltasUntilRef.current = Date.now() + 2_000;
        }
      }
    })();

    refreshInFlightRef.current = run;
    try {
      await run;
    } finally {
      if (refreshInFlightRef.current === run) {
        refreshInFlightRef.current = null;
      }
      if (rosterDirtyDuringRefreshRef.current) {
        rosterDirtyDuringRefreshRef.current = false;

        window.setTimeout(() => {
          void refresh();
        }, 0);
      }
    }
  }, [seedPresence, onSelect]);

  const scheduleRefresh = useCallback(() => {
    if (refreshDebounceRef.current) {
      clearTimeout(refreshDebounceRef.current);
    }
    refreshDebounceRef.current = setTimeout(() => {
      refreshDebounceRef.current = undefined;
      void refresh();
    }, 750);
  }, [refresh]);
  const scheduleRefreshRef = useRef(scheduleRefresh);
  scheduleRefreshRef.current = scheduleRefresh;

  useEffect(
    () => () => {
      if (refreshDebounceRef.current) {
        clearTimeout(refreshDebounceRef.current);
      }
    },
    [],
  );

  const muteExpiryKey = channels
    .filter((ch) => ch.isMutedHere && ch.mutedHereExpiresAt)
    .map((ch) => `${ch._id}:${ch.mutedHereExpiresAt}`)
    .sort()
    .join("|");
  useEffect(() => {
    if (!muteExpiryKey) return;
    const now = Date.now();
    const timers: ReturnType<typeof setTimeout>[] = [];
    const clearMute = (channelId: string) => {
      setChannels((prev) =>
        prev.map((ch) =>
          ch._id === channelId
            ? { ...ch, isMutedHere: false, mutedHereExpiresAt: null }
            : ch,
        ),
      );
      const current = activeRef.current;
      if (current?.type === "channel" && current.channel._id === channelId) {
        onSelect({
          type: "channel",
          channel: {
            ...current.channel,
            isMutedHere: false,
            mutedHereExpiresAt: null,
          },
        });
      }
    };
    for (const entry of muteExpiryKey.split("|")) {
      const sep = entry.indexOf(":");
      if (sep < 0) continue;
      const channelId = entry.slice(0, sep);
      const expiresAt = Date.parse(entry.slice(sep + 1));
      if (!Number.isFinite(expiresAt)) continue;
      const delay = expiresAt - now;
      if (delay <= 0) {
        clearMute(channelId);
        continue;
      }
      timers.push(setTimeout(() => clearMute(channelId), delay));
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [muteExpiryKey, onSelect]);

  const displayContacts = contacts;

  useEffect(() => {
    if (!active) return;
    if (active.type === "dm") {
      const id = active.contact._id;
      setContacts((prev) => {
        let changed = false;
        const next = prev.map((c) => {
          if (c._id !== id || (c.unreadCount ?? 0) === 0) return c;
          changed = true;
          return { ...c, unreadCount: 0 };
        });
        return changed ? next : prev;
      });
      return;
    }
    const id = active.channel._id;
    setChannels((prev) => {
      let changed = false;
      const next = prev.map((ch) => {
        if (ch._id !== id || (ch.unreadCount ?? 0) === 0) return ch;
        changed = true;
        return { ...ch, unreadCount: 0 };
      });
      return changed ? next : prev;
    });
  }, [active]);

  useEffect(() => { refresh(); }, [refresh]);

  const wsWasConnectedRef = useRef(wsConnected);
  useEffect(() => {
    const was = wsWasConnectedRef.current;
    wsWasConnectedRef.current = wsConnected;
    if (!wsConnected || was) return;

    ignoreUnreadDeltasUntilRef.current = Number.POSITIVE_INFINITY;
    unreadRevisionRef.current.clear();
    unreadGenerationRef.current.clear();

    dirtyUnreadDuringRefreshRef.current.clear();
    staleAllMessagePageCaches();
    scheduleRefresh();
  }, [wsConnected, scheduleRefresh]);

  useEffect(() => {
    return subscribeMutedConversations(() => {

      const unmutedKeys: string[] = [];
      for (const c of contactsSnapshotRef.current) {
        const key = `dm:${c._id}`;
        const muted = isConversationMuted("dm", c._id);
        if (!muted && c.isMuted) unmutedKeys.push(key);
        if (muted) {
          rawUnreadRef.current.set(key, 0);
          dirtyUnreadDuringRefreshRef.current.delete(key);
        }
      }
      for (const ch of channelsSnapshotRef.current) {
        const key = `channel:${ch._id}`;
        const muted = isConversationMuted("channel", ch._id);
        if (!muted && ch.isMuted) unmutedKeys.push(key);
        if (muted) {
          rawUnreadRef.current.set(key, 0);
          dirtyUnreadDuringRefreshRef.current.delete(key);
        }
      }
      for (const key of unmutedKeys) {
        dirtyUnreadDuringRefreshRef.current.delete(key);
      }
      setContacts((prev) => {
        let changed = false;
        const next = prev.map((c) => {
          const muted = isConversationMuted("dm", c._id);
          if (!!c.isMuted === muted) return c;
          changed = true;
          return {
            ...c,
            isMuted: muted,
            ...(muted ? { unreadCount: 0 } : {}),
          };
        });
        return changed ? next : prev;
      });
      setChannels((prev) => {
        let changed = false;
        const next = prev.map((ch) => {
          const muted = isConversationMuted("channel", ch._id);
          if (!!ch.isMuted === muted) return ch;
          changed = true;
          return {
            ...ch,
            isMuted: muted,
            ...(muted ? { unreadCount: 0 } : {}),
          };
        });
        return changed ? next : prev;
      });
      if (unmutedKeys.length === 0) return;
      scheduleRefresh();
    });
  }, [scheduleRefresh]);

  const applyUnreadUpdate = useCallback(
    (payload: {
      type: "dm" | "channel";
      id: string;
      unreadCount?: number;
      delta?: number;
      revision?: number;
      generation?: number;
    }) => {
      const key = `${payload.type}:${payload.id}`;
      if (wipedUnreadKeysRef.current.has(key)) return;
      const rejectOffRoster = (): boolean => {
        const inRoster =
          payload.type === "dm"
            ? contactsSnapshotRef.current.some((c) => c._id === payload.id)
            : channelsSnapshotRef.current.some((ch) => ch._id === payload.id);
        if (inRoster) return false;
        rawUnreadRef.current.delete(key);
        dirtyUnreadDuringRefreshRef.current.delete(key);
        rosterDirtyDuringRefreshRef.current = true;
        scheduleRefreshRef.current();
        return true;
      };
      const gen = payload.generation ?? 0;
      const lastGen = unreadGenerationRef.current.get(key) ?? 0;
      const isAbsolute = typeof payload.unreadCount === "number";

      if (gen < lastGen) {
        return;
      }

      const rev = payload.revision ?? 0;

      if (!isAbsolute && gen === lastGen && rev <= 0) return;
      if (isAbsolute || gen > lastGen) {
        unreadGenerationRef.current.set(key, gen);
      }

      {
        const last = unreadRevisionRef.current.get(key) ?? 0;
        if (rev > 0) {
          if (!isAbsolute && rev <= last) return;

          if (isAbsolute && gen === lastGen && last > 0 && rev < last) {

            return;
          }
          unreadRevisionRef.current.set(
            key,
            isAbsolute ? Math.max(last, rev) : rev,
          );
        } else if (isAbsolute && gen === lastGen && last > 0) {

          return;
        }
      }

      const ignoreUntil = ignoreUnreadDeltasUntilRef.current;
      const ignoringDeltas =
        !isAbsolute && Date.now() < ignoreUntil;

      const applyRawOnly =
        ignoringDeltas && ignoreUntil === Number.POSITIVE_INFINITY;

      const current = activeRef.current;
      const viewing =
        (payload.type === "dm" &&
          current?.type === "dm" &&
          current.contact._id === payload.id) ||
        (payload.type === "channel" &&
          current?.type === "channel" &&
          current.channel._id === payload.id);

      if (isAbsolute) {

        ackPendingMarkReadByKey(key);

        const mutedAbs = isConversationMuted(
          payload.type === "dm" ? "dm" : "channel",
          payload.id,
        );
        if (!mutedAbs) dirtyUnreadDuringRefreshRef.current.add(key);
      }

      if (payload.type === "dm") {
        if (applyRawOnly) {
          if (typeof payload.delta === "number") {
            if (!rawUnreadRef.current.has(key)) return;
            if (rejectOffRoster()) return;
            const muted = isConversationMuted("dm", payload.id);
            const prev = rawUnreadRef.current.get(key) ?? 0;
            rawUnreadRef.current.set(
              key,
              muted ? 0 : Math.max(0, prev + payload.delta),
            );
            if (!muted) dirtyUnreadDuringRefreshRef.current.add(key);
          } else if (typeof payload.unreadCount === "number") {

            if (rejectOffRoster()) return;
            const muted = isConversationMuted("dm", payload.id);
            rawUnreadRef.current.set(
              key,
              muted ? 0 : Math.max(0, payload.unreadCount),
            );
            if (!muted) dirtyUnreadDuringRefreshRef.current.add(key);
          }
          return;
        }
        const muted = isConversationMuted("dm", payload.id);
        let raw: number;
        if (muted) {
          raw = 0;
        } else if (typeof payload.delta === "number") {
          if (!rawUnreadRef.current.has(key)) {
            rosterDirtyDuringRefreshRef.current = true;
            scheduleRefreshRef.current();
            return;
          }
          raw = Math.max(
            0,
            (rawUnreadRef.current.get(key) ?? 0) + payload.delta,
          );
        } else if (typeof payload.unreadCount === "number") {
          raw = Math.max(0, payload.unreadCount);
        } else {
          raw = rawUnreadRef.current.get(key) ?? 0;
        }
        if (rejectOffRoster()) return;
        rawUnreadRef.current.set(key, raw);
        setContacts((prev) =>
          prev.map((c) => {
            if (c._id !== payload.id) return c;

            return { ...c, unreadCount: viewing || muted ? 0 : raw };
          }),
        );
        return;
      }

      if (applyRawOnly) {
        if (typeof payload.delta === "number") {
          if (!rawUnreadRef.current.has(key)) return;
          if (rejectOffRoster()) return;
          const muted = isConversationMuted("channel", payload.id);
          const prev = rawUnreadRef.current.get(key) ?? 0;
          rawUnreadRef.current.set(
            key,
            muted ? 0 : Math.max(0, prev + payload.delta),
          );
          if (!muted) dirtyUnreadDuringRefreshRef.current.add(key);
        } else if (typeof payload.unreadCount === "number") {

          if (rejectOffRoster()) return;
          const muted = isConversationMuted("channel", payload.id);
          rawUnreadRef.current.set(
            key,
            muted ? 0 : Math.max(0, payload.unreadCount),
          );
          if (!muted) dirtyUnreadDuringRefreshRef.current.add(key);
        }
        return;
      }

      {
        const muted = isConversationMuted("channel", payload.id);
        let raw: number;
        if (muted) {
          raw = 0;
        } else if (typeof payload.delta === "number") {
          if (!rawUnreadRef.current.has(key)) {
            rosterDirtyDuringRefreshRef.current = true;
            scheduleRefreshRef.current();
            return;
          }
          raw = Math.max(
            0,
            (rawUnreadRef.current.get(key) ?? 0) + payload.delta,
          );
        } else if (typeof payload.unreadCount === "number") {
          raw = Math.max(0, payload.unreadCount);
        } else {
          raw = rawUnreadRef.current.get(key) ?? 0;
        }
        if (rejectOffRoster()) return;
        rawUnreadRef.current.set(key, raw);
        setChannels((prev) =>
          prev.map((ch) => {
            if (ch._id !== payload.id) return ch;
            return { ...ch, unreadCount: viewing || muted ? 0 : raw };
          }),
        );
      }
    },
    [],
  );

  const handleRemoveContact = async () => {
    if (!removeContactInfo) return;
    setRemoveContactSending(true);
    try {
      await removeFriend(removeContactInfo._id);
      invalidateFriendshipCache(removeContactInfo._id);
      if (active?.type === "dm" && active.contact._id === removeContactInfo._id) {
        onSelect(null);
      }
      if (contactProfile?._id === removeContactInfo._id) {
        setContactProfileOpen(false);
        setContactProfile(null);
      }
      await refresh();
      handleCloseRemoveContact();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sidebar.toast.contactRemoveFailed"));
    } finally {
      setRemoveContactSending(false);
    }
  };

  const handleCloseContactsModal = () => {
    if (contactsModalClosing) return;
    setContactsModalClosing(true);
    window.setTimeout(() => {
      setContactsModalOpen(false);
      setContactsModalClosing(false);
    }, 220);
  };

  const handleCloseNewChannel = (callback?: () => void) => {
    if (newChannelClosing) return;
    setNewChannelClosing(true);
    window.setTimeout(() => {
      setShowNewChannel(false);
      setNewChannelClosing(false);
      if (callback) callback();
    }, 220);
  };

  const handleCloseRenameChannel = () => {
    if (renameChannelClosing) return;
    setRenameChannelClosing(true);
    window.setTimeout(() => {
      setRenameChannelInfo(null);
      setRenameChannelClosing(false);
    }, 220);
  };

  const handleCloseRemoveContact = () => {
    if (removeContactClosing || removeContactSending) return;
    setRemoveContactClosing(true);
    window.setTimeout(() => {
      setRemoveContactInfo(null);
      setRemoveContactClosing(false);
    }, 220);
  };

  const handleCloseDeleteChannel = () => {
    if (deleteChannelClosing) return;
    setDeleteChannelClosing(true);
    window.setTimeout(() => {
      setDeleteChannelInfo(null);
      setDeleteChannelClosing(false);
    }, 220);
  };

  useEffect(() => {
    if (!ws) return;
    const onRenamed = (e: { channelId: string; name: string }) => {
      setChannels((p) => p.map((ch) => ch._id === e.channelId ? { ...ch, name: e.name } : ch));
      if (activeRef.current?.type === "channel" && activeRef.current.channel._id === e.channelId)
        onSelectRef.current({ type: "channel", channel: { ...activeRef.current.channel, name: e.name } });
    };
    const onDeleted = (e: { channelId: string }) => {
      ackPendingMarkReadByKey(`channel:${e.channelId}`);
      channelsSnapshotRef.current = channelsSnapshotRef.current.filter(
        (ch) => ch._id !== e.channelId,
      );
      setChannels((p) => p.filter((ch) => ch._id !== e.channelId));
      rawUnreadRef.current.delete(`channel:${e.channelId}`);
      removeMessagePageCache(channelCacheKey(e.channelId));
      if (activeRef.current?.type === "channel" && activeRef.current.channel._id === e.channelId) onSelectRef.current(null);
      if (channelSettingsInfoRef.current?.channelId === e.channelId) setChannelSettingsInfo(null);
      if (renameChannelInfoRef.current?.channelId === e.channelId) setRenameChannelInfo(null);
      if (deleteChannelInfoRef.current?.channelId === e.channelId) setDeleteChannelInfo(null);
    };
    const onAvatarUpdated = (e: { channelId: string; image: string }) => {
      setChannels((p) => p.map((ch) => ch._id === e.channelId ? { ...ch, image: e.image } : ch));
      if (activeRef.current?.type === "channel" && activeRef.current.channel._id === e.channelId)
        onSelectRef.current({ type: "channel", channel: { ...activeRef.current.channel, image: e.image } });
    };
    const onSlowmodeUpdated = (e: { channelId: string; rateLimitPerUser: number }) => {
      setChannels((p) => p.map((ch) => ch._id === e.channelId ? { ...ch, rateLimitPerUser: e.rateLimitPerUser } : ch));
      if (activeRef.current?.type === "channel" && activeRef.current.channel._id === e.channelId)
        onSelectRef.current({ type: "channel", channel: { ...activeRef.current.channel, rateLimitPerUser: e.rateLimitPerUser } });
    };
    const onChatLockUpdated = (e: { channelId: string; chatLocked: boolean }) => {
      setChannels((p) => p.map((ch) => ch._id === e.channelId ? { ...ch, chatLocked: e.chatLocked } : ch));
      if (activeRef.current?.type === "channel" && activeRef.current.channel._id === e.channelId)
        onSelectRef.current({ type: "channel", channel: { ...activeRef.current.channel, chatLocked: e.chatLocked } });
    };
    const onModerationUpdated = (e: {
      channelId: string;
      isMutedHere: boolean;
      mutedHereExpiresAt?: string | null;
    }) => {
      const expires =
        e.isMutedHere === false
          ? null
          : e.mutedHereExpiresAt === undefined
            ? undefined
            : e.mutedHereExpiresAt;
      setChannels((p) =>
        p.map((ch) =>
          ch._id === e.channelId
            ? {
                ...ch,
                isMutedHere: e.isMutedHere,
                ...(expires !== undefined ? { mutedHereExpiresAt: expires } : {}),
              }
            : ch,
        ),
      );
      if (activeRef.current?.type === "channel" && activeRef.current.channel._id === e.channelId) {
        onSelectRef.current({
          type: "channel",
          channel: {
            ...activeRef.current.channel,
            isMutedHere: e.isMutedHere,
            ...(expires !== undefined ? { mutedHereExpiresAt: expires } : {}),
          },
        });
      }
    };
    const onChannelAdded = (payload: { channelId?: string; channel?: Channel }) => {
      if (ignoreUnreadDeltasUntilRef.current === Number.POSITIVE_INFINITY) {
        rosterDirtyDuringRefreshRef.current = true;
      }
      if (payload.channel?._id) {
        const ch = payload.channel;
        const key = `channel:${ch._id}`;

        const muted = isConversationMuted("channel", ch._id);
        const unread = muted ? 0 : Math.max(0, ch.unreadCount ?? 0);
        rawUnreadRef.current.set(key, unread);
        setChannels((prev) => {
          if (prev.some((c) => c._id === ch._id)) return prev;
          const next = [{ ...ch, isMuted: muted, unreadCount: unread }, ...prev];
          channelsSnapshotRef.current = next;
          return next;
        });
        return;
      }
      scheduleRefresh();
    };
    const onChannelLeft = (e: { channelId: string }) => {
      const key = `channel:${e.channelId}`;
      ackPendingMarkReadByKey(key);
      channelsSnapshotRef.current = channelsSnapshotRef.current.filter(
        (ch) => ch._id !== e.channelId,
      );
      setChannels((p) => p.filter((ch) => ch._id !== e.channelId));
      rawUnreadRef.current.delete(key);
      removeMessagePageCache(channelCacheKey(e.channelId));
      if (activeRef.current?.type === "channel" && activeRef.current.channel._id === e.channelId) onSelectRef.current(null);
      if (channelSettingsInfoRef.current?.channelId === e.channelId) setChannelSettingsInfo(null);
      if (renameChannelInfoRef.current?.channelId === e.channelId) setRenameChannelInfo(null);
      if (deleteChannelInfoRef.current?.channelId === e.channelId) setDeleteChannelInfo(null);
    };
    const onChannelMemberLeft = (e: {
      channelId: string;
      userId?: string;
      memberCount?: number;
    }) => {
      if (!e.channelId) return;

      if (e.userId && userIdRef.current && e.userId === userIdRef.current) {
        ackPendingMarkReadByKey(`channel:${e.channelId}`);
        channelsSnapshotRef.current = channelsSnapshotRef.current.filter(
          (ch) => ch._id !== e.channelId,
        );
        setChannels((p) => p.filter((ch) => ch._id !== e.channelId));
        rawUnreadRef.current.delete(`channel:${e.channelId}`);
        removeMessagePageCache(channelCacheKey(e.channelId));
        if (activeRef.current?.type === "channel" && activeRef.current.channel._id === e.channelId) {
          onSelectRef.current(null);
        }
        if (channelSettingsInfoRef.current?.channelId === e.channelId) setChannelSettingsInfo(null);
        if (renameChannelInfoRef.current?.channelId === e.channelId) setRenameChannelInfo(null);
        if (deleteChannelInfoRef.current?.channelId === e.channelId) setDeleteChannelInfo(null);
        return;
      }
      setChannels((p) =>
        p.map((ch) => {
          if (ch._id !== e.channelId) return ch;
          const members = e.userId
            ? (ch.members ?? []).filter((m) => m._id !== e.userId)
            : ch.members;
          return {
            ...ch,
            members,
            memberCount:
              typeof e.memberCount === "number" ? e.memberCount : ch.memberCount,
          };
        }),
      );
      if (activeRef.current?.type === "channel" && activeRef.current.channel._id === e.channelId) {
        const ch = activeRef.current.channel;
        const members = e.userId
          ? (ch.members ?? []).filter((m) => m._id !== e.userId)
          : ch.members;
        onSelectRef.current({
          type: "channel",
          channel: {
            ...ch,
            members,
            memberCount:
              typeof e.memberCount === "number" ? e.memberCount : ch.memberCount,
          },
        });
      }
    };
    const onChannelMemberJoined = (e: {
      channelId: string;
      userId?: string;
      memberCount?: number;
    }) => {
      if (!e.channelId) return;
      setChannels((p) =>
        p.map((ch) => {
          if (ch._id !== e.channelId) return ch;
          return {
            ...ch,
            memberCount:
              typeof e.memberCount === "number" ? e.memberCount : ch.memberCount,
          };
        }),
      );
      const channelId = e.channelId;
      const memberCount = e.memberCount;

      const pending = rosterDetailsDebounceRef.current.get(channelId);
      if (pending) clearTimeout(pending);
      rosterDetailsDebounceRef.current.set(
        channelId,
        setTimeout(() => {
          rosterDetailsDebounceRef.current.delete(channelId);
          void getChannelDetails(channelId)
            .then((res) => {
              setChannels((p) =>
                p.map((ch) =>
                  ch._id === channelId
                    ? {
                        ...ch,
                        members: res.channel.members ?? ch.members,
                        memberCount:
                          typeof memberCount === "number"
                            ? memberCount
                            : (res.channel.memberCount ?? ch.memberCount),
                      }
                    : ch,
                ),
              );
              const current = activeRef.current;
              if (current?.type === "channel" && current.channel._id === channelId) {
                onSelectRef.current({
                  type: "channel",
                  channel: {
                    ...current.channel,
                    ...res.channel,
                    members: res.channel.members ?? current.channel.members,
                    memberCount:
                      typeof memberCount === "number"
                        ? memberCount
                        : (res.channel.memberCount ?? current.channel.memberCount),

                    isMuted: isConversationMuted("channel", channelId),
                    unreadCount: 0,
                  },
                });
              }
            })
            .catch(() => {

            });
        }, 300),
      );
    };
    const onConversationDeleted = (e: { contactId?: string }) => {
      const contactId = e.contactId;
      if (!contactId) return;
      const key = `dm:${contactId}`;
      ackPendingMarkReadByKey(key);
      removeMessagePageCache(dmCacheKey(contactId));
      wipedUnreadKeysRef.current.add(key);
      rawUnreadRef.current.set(key, 0);
      dirtyUnreadDuringRefreshRef.current.delete(key);

      const prevGen = unreadGenerationRef.current.get(key) ?? 0;
      unreadGenerationRef.current.set(key, prevGen + 1);
      unreadRevisionRef.current.delete(key);
      setContacts((prev) => {
        const next = prev.map((c) =>
          c._id === contactId
            ? {
                ...c,
                lastMessage: undefined,
                lastMessageTime: undefined,
                lastMessageId: undefined,
                unreadCount: 0,
              }
            : c,
        );
        contactsSnapshotRef.current = next;
        return next;
      });
      if (activeRef.current?.type === "dm" && activeRef.current.contact._id === contactId) {
        onSelectRef.current(null);
      }
    };
    const onFriendshipRemoved = (e: { userId?: string }) => {
      const peerId = e.userId;
      if (!peerId) return;
      ackPendingMarkReadByKey(`dm:${peerId}`);
      invalidateFriendshipCache(peerId);
      removeMessagePageCache(dmCacheKey(peerId));
      rawUnreadRef.current.delete(`dm:${peerId}`);
      contactsSnapshotRef.current = contactsSnapshotRef.current.filter(
        (c) => c._id !== peerId,
      );
      setContacts((prev) => prev.filter((c) => c._id !== peerId));
      if (activeRef.current?.type === "dm" && activeRef.current.contact._id === peerId) {
        onSelectRef.current(null);
      }
      if (contactProfileRef.current?._id === peerId) {
        setContactProfileOpen(false);
        setContactProfile(null);
      }
    };
    const onFriendshipAdded = (e: { contact?: Contact }) => {
      const contact = e.contact;
      if (!contact?._id) {
        scheduleRefresh();
        return;
      }
      if (ignoreUnreadDeltasUntilRef.current === Number.POSITIVE_INFINITY) {
        rosterDirtyDuringRefreshRef.current = true;
      }
      invalidateFriendshipCache(contact._id);

      const muted = isConversationMuted("dm", contact._id);
      const key = `dm:${contact._id}`;
      const unread = muted ? 0 : Math.max(0, contact.unreadCount ?? 0);
      rawUnreadRef.current.set(key, unread);
      setContacts((prev) => {
        if (prev.some((c) => c._id === contact._id)) {
          const next = prev.map((c) =>
            c._id === contact._id
              ? { ...c, ...contact, isMuted: muted, unreadCount: unread }
              : c,
          );
          contactsSnapshotRef.current = next;
          return next;
        }
        const next = [{ ...contact, isMuted: muted, unreadCount: unread }, ...prev];
        contactsSnapshotRef.current = next;
        return next;
      });
      seedPresence([contact]);
    };
    const onBlockUpdated = (e: {
      contactId?: string;
      isBlockedByMe?: boolean;
      isBlockedByOther?: boolean;
    }) => {
      const id = e.contactId;
      if (!id) return;
      const patch: Partial<Contact> = {};
      if (typeof e.isBlockedByMe === "boolean") patch.isBlockedByMe = e.isBlockedByMe;
      if (typeof e.isBlockedByOther === "boolean") {

      }
      if (Object.keys(patch).length === 0) return;
      setContacts((prev) =>
        prev.map((c) => (c._id === id ? { ...c, ...patch } : c)),
      );
      const profile = contactProfileRef.current;
      if (profile?._id === id) {
        setContactProfile({ ...profile, ...patch });
      }
    };
    const unsubs = [
      ws.subscribe(WsType.CHANNEL_NAME_UPDATED, onRenamed),
      ws.subscribe(WsType.CHANNEL_SLOWMODE_UPDATED, onSlowmodeUpdated),
      ws.subscribe(WsType.CHANNEL_CHAT_LOCKED_UPDATED, onChatLockUpdated),
      ws.subscribe(WsType.CHANNEL_MODERATION_UPDATED, onModerationUpdated),
      ws.subscribe(WsType.CHANNEL_DELETED, onDeleted),
      ws.subscribe(WsType.CHANNEL_AVATAR_UPDATED, onAvatarUpdated),
      ws.subscribe(WsType.CHANNEL_ADDED, onChannelAdded),
      ws.subscribe(WsType.CHANNEL_LEFT, onChannelLeft),
      ws.subscribe(WsType.CHANNEL_MEMBER_LEFT, onChannelMemberLeft),
      ws.subscribe(WsType.CHANNEL_MEMBER_JOINED, onChannelMemberJoined),
      ws.subscribe(WsType.CONVERSATION_DELETED, onConversationDeleted),
      ws.subscribe(WsType.FRIENDSHIP_REMOVED, onFriendshipRemoved),
      ws.subscribe(WsType.FRIENDSHIP_ADDED, onFriendshipAdded),
      ws.subscribe(WsType.CONTACT_BLOCK_UPDATED, onBlockUpdated),
    ];
    return () => unsubs.forEach((u) => u());
  }, [ws, scheduleRefresh, seedPresence]);

  useEffect(() => {
    if (!ws) return;

    const onUnreadUpdated = (payload: {
      type: "dm" | "channel";
      id: string;
      unreadCount?: number;
      delta?: number;
      revision?: number;
      generation?: number;
    }) => {
      applyUnreadUpdate(payload);
    };

    const getSenderId = (msg: Message): string | undefined => {
      const s = msg?.sender;
      if (!s) return undefined;
      return typeof s === "string" ? s : s._id ?? s.id;
    };

    const onDmMessage = (msg: Message) => {
      setContacts((prev) =>
        patchContactsFromMessage(prev, msg, currentUserIdRef.current),
      );

      const senderId = getSenderId(msg);
      if (!senderId || senderId === currentUserIdRef.current) return;
      if (isConversationMuted("dm", senderId)) return;
      if (availabilityRef.current === "dnd") return;
      playNotificationSound();
    };

    const onChannelMessage = (msg: Message) => {
      setChannels((prev) => patchChannelsFromMessage(prev, msg));

      const senderId = getSenderId(msg);
      if (!senderId || senderId === currentUserIdRef.current) return;
      const channelId = msg?.channelId ?? msg?.channel;
      if (typeof channelId === "string" && isConversationMuted("channel", channelId)) return;
      if (availabilityRef.current === "dnd") return;
      playNotificationSound();
    };

    const onMessageEdited = (msg: Message) => {
      setContacts((prev) =>
        patchContactsFromEditedMessage(prev, msg, currentUserIdRef.current),
      );
      setChannels((prev) => patchChannelsFromEditedMessage(prev, msg));
    };

    const onMessageDeleted = (data: { _id?: string }) => {
      const id = data?._id;
      if (!id) return;
      const contactResult = patchContactsOnMessageDeleted(
        contactsRef.current,
        id,
      );
      const channelResult = patchChannelsOnMessageDeleted(
        channelsRef.current,
        id,
      );
      if (contactResult.changed) setContacts(contactResult.contacts);
      if (channelResult.changed) setChannels(channelResult.channels);
      if (contactResult.needsRefresh || channelResult.needsRefresh) {
        scheduleRefresh();
      }
    };

    const unsubs = [
      ws.subscribe(WsType.MESSAGE_DELETED, onMessageDeleted),
      ws.subscribe(WsType.MESSAGE_EDITED, onMessageEdited),
      ws.subscribe(WsType.RECEIVE_MESSAGE, onDmMessage),
      ws.subscribe(WsType.RECEIVE_CHANNEL_MESSAGE, onChannelMessage),
      ws.subscribe(WsType.UNREAD_UPDATED, onUnreadUpdated),
    ];
    return () => unsubs.forEach((u) => u());
  }, [ws, scheduleRefresh, applyUnreadUpdate]);

  useEffect(() => {
    const unsubTip = subscribeSidebarTipFromMessage((msg) => {
      setContacts((prev) =>
        patchContactsFromMessage(prev, msg, currentUserIdRef.current),
      );
      setChannels((prev) => patchChannelsFromMessage(prev, msg));
    });
    const unsubRevert = subscribeSidebarTipRevert((msg) => {
      const id = msg._id;
      if (!id) return;
      const contactResult = patchContactsOnMessageDeleted(
        contactsRef.current,
        id,
      );
      const channelResult = patchChannelsOnMessageDeleted(
        channelsRef.current,
        id,
      );
      if (contactResult.changed) setContacts(contactResult.contacts);
      if (channelResult.changed) setChannels(channelResult.channels);
    });
    return () => {
      unsubTip();
      unsubRevert();
    };
  }, []);

  const clearMention = useCallback((sourceId: string) => {
    clearMentionSource(sourceId);
  }, []);

  useEffect(() => {
    if (!ws) return;
    const onMention = (payload: MentionEvent) => {
      if (!payload?.sourceId) return;
      if (availabilityRef.current === "dnd") return;
      const muted =
        payload.scope === "dm"
          ? isConversationMuted("dm", payload.sourceId)
          : isConversationMuted("channel", payload.sourceId);
      if (muted) return;

      const cur = activeRef.current;
      const viewing =
        (payload.scope === "dm" &&
          cur?.type === "dm" &&
          cur.contact._id === payload.sourceId) ||
        (payload.scope === "channel" &&
          cur?.type === "channel" &&
          cur.channel._id === payload.sourceId);
      if (viewing) return;

      addMentionSource(payload.sourceId);
      setMentionToast({ ...payload, key: Date.now() });
    };
    const unsub = ws.subscribe(WsType.MESSAGE_MENTION, onMention);
    return () => unsub();
  }, [ws]);

  useEffect(() => {
    if (!mentionToast) return;
    if (mentionToastTimeout.current) clearTimeout(mentionToastTimeout.current);
    mentionToastTimeout.current = setTimeout(() => setMentionToast(null), 6000);
    return () => {
      if (mentionToastTimeout.current) clearTimeout(mentionToastTimeout.current);
    };
  }, [mentionToast]);

  const openMentionFromToast = useCallback(() => {
    if (!mentionToast) return;
    if (mentionToast.scope === "dm") {
      const contact = contactsRef.current.find((c) => c._id === mentionToast.sourceId);
      if (contact) {
        clearMention(contact._id);
        const storeMuted = isConversationMuted("dm", contact._id);
        onSelect({
          type: "dm",
          contact: { ...contact, isMuted: storeMuted, unreadCount: 0 },
        });
        setContacts((prev) =>
          prev.map((c) =>
            c._id === contact._id
              ? { ...c, isMuted: storeMuted, unreadCount: 0 }
              : c,
          ),
        );
      }
    } else {
      const channel = channelsRef.current.find((ch) => ch._id === mentionToast.sourceId);
      if (channel) {
        clearMention(channel._id);
        const storeMuted = isConversationMuted("channel", channel._id);
        onSelect({
          type: "channel",
          channel: { ...channel, isMuted: storeMuted, unreadCount: 0 },
        });
        setChannels((prev) =>
          prev.map((ch) =>
            ch._id === channel._id
              ? { ...ch, isMuted: storeMuted, unreadCount: 0 }
              : ch,
          ),
        );
      }
    }
    setMentionToast(null);
  }, [mentionToast, onSelect, clearMention]);

  useProfileSync(ws, {
    onInfo: ({ userId, username, displayName, bio, color }) => {
      setContacts((prev) =>
        prev.map((c) =>
          c._id === userId
            ? {
                ...c,
                username: username ?? c.username,
                displayName: displayName ?? c.displayName,
                bio: bio ?? c.bio,
                color: color ?? c.color,
              }
            : c,
        ),
      );
      setContactProfile((prev) =>
        prev && prev._id === userId
          ? {
              ...prev,
              username: username ?? prev.username,
              displayName: displayName ?? prev.displayName,
              bio: bio ?? prev.bio,
              color: color ?? prev.color,
            }
          : prev,
      );
    },
    onImage: ({ userId, image }) =>
      setContacts((prev) =>
        prev.map((c) => (c._id === userId ? { ...c, image } : c)),
      ),
    onBanner: ({ userId, banner }) =>
      setContacts((prev) =>
        prev.map((c) => (c._id === userId ? { ...c, banner } : c)),
      ),
  });

  useEffect(() => {
    if (showNewChannel || renameChannelInfo)
      setTimeout(() => channelInputRef.current?.focus(), 50);
  }, [showNewChannel, renameChannelInfo]);

  useEffect(() => {
    if (!showNewChannel) return;
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") handleCloseNewChannel(); };
    document.addEventListener("keydown", fn); return () => document.removeEventListener("keydown", fn);
  }, [showNewChannel, newChannelClosing]);

  useEffect(() => {
    if (!renameChannelInfo) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseRenameChannel();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [renameChannelInfo]);

  useEffect(() => {
    if (!deleteChannelInfo) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseDeleteChannel();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [deleteChannelInfo]);

  useEffect(() => {
    if (!removeContactInfo) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCloseRemoveContact();
    };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, [removeContactInfo, removeContactClosing, removeContactSending]);

  useEffect(() => {
    if (!contextMenu) return;
    const handlePointer = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };

    const attachTimer = window.setTimeout(() => {
      document.addEventListener("mousedown", handlePointer);
    }, 0);
    document.addEventListener("keydown", handleKey);
    return () => {
      window.clearTimeout(attachTimer);
      document.removeEventListener("mousedown", handlePointer);
      document.removeEventListener("keydown", handleKey);
    };
  }, [contextMenu]);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!searchTerm.trim()) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      try { const { contacts } = await searchContacts(searchTerm); setSearchResults(contacts); }
      catch { setSearchResults([]); }
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchTerm]);

  const handleNewChannel = async () => {
    const name = channelName.trim(); if (!name) return;
    try {
      const { channel } = await createChannel(name);
      setChannelName("");
      const seeded = {
        ...channel,
        members: channel.members ?? [],
        memberCount:
          channel.memberCount ?? ((channel.members?.length ?? 0) + 1),
        isMuted: isConversationMuted("channel", channel._id),
        unreadCount: 0,
      };
      handleCloseNewChannel(() => {
        setChannels((prev) => {
          if (prev.some((ch) => ch._id === channel._id)) return prev;
          return [seeded, ...prev];
        });
        onSelect({ type: "channel", channel: seeded });
      });
      toast.success(t("sidebar.toast.channelCreated", { name: channel.name }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sidebar.toast.channelCreateFailed"));
    }
  };

  const handleRenameChannel = async () => {
    if (!renameChannelInfo) return;
    const name = renameChannelName.trim(); if (!name) return;
    try {
      const channelId = renameChannelInfo.channelId;
      const { name: updatedName } = await renameChannel(channelId, name);
      setRenameChannelName("");
      setChannels((prev) =>
        prev.map((ch) => (ch._id === channelId ? { ...ch, name: updatedName } : ch)),
      );
      if (active?.type === "channel" && active.channel._id === channelId)
        onSelect({ type: "channel", channel: { ...active.channel, name: updatedName } });
      handleCloseRenameChannel();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("sidebar.toast.channelRenameFailed")); }
  };

  const handleChannelAvatarChange = async (file: File) => {
    if (!uploadAvatarChannel) return;
    const target = uploadAvatarChannel;
    setChannelAvatarUploading(true);
    try {
      const { image } = await uploadChannelAvatar(target.channelId, file);
      bumpPublicMediaCache(image);
      bumpPublicMediaCacheForChannel(target.channelId);
      setUploadAvatarChannel(null);
      setChannelCropFile(null);
      setTimeout(() => { if (channelAvatarInputRef.current) channelAvatarInputRef.current.value = ""; }, 0);
      await refresh();
      if (active?.type === "channel" && active.channel._id === target.channelId)
        onSelect({ type: "channel", channel: { ...active.channel, image } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sidebar.toast.channelAvatarFailed"));
      throw err;
    } finally {
      setChannelAvatarUploading(false);
    }
  };

  const handleDeleteChannel = async () => {
    if (!deleteChannelInfo) return;
    const channelId = deleteChannelInfo.channelId;
    try {
      await deleteChannel(channelId);
      await refresh();
      if (active?.type === "channel" && active.channel._id === channelId) onSelect(null);
      handleCloseDeleteChannel();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("sidebar.toast.channelDeleteFailed")); }
  };

  useEffect(() => {
    if (!active) return;
    const id = active.type === "dm" ? active.contact._id : active.channel._id;
    clearMention(id);
  }, [active, clearMention]);

  const prevActiveKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const nextKey = active
      ? active.type === "dm"
        ? `dm:${active.contact._id}`
        : `channel:${active.channel._id}`
      : null;
    const prevKey = prevActiveKeyRef.current;
    prevActiveKeyRef.current = nextKey;
    if (!prevKey || prevKey === nextKey) return;
    const pendingZero = new Set(peekPendingMarkReadKeys());
    if (pendingZero.has(prevKey)) return;
    const kind = prevKey.startsWith("dm:") ? "dm" : "channel";
    const id = prevKey.slice(prevKey.indexOf(":") + 1);
    if (isConversationMuted(kind, id)) return;
    const raw = Math.max(0, rawUnreadRef.current.get(prevKey) ?? 0);
    if (kind === "dm") {
      setContacts((prev) =>
        prev.map((c) => (c._id === id ? { ...c, unreadCount: raw } : c)),
      );
    } else {
      setChannels((prev) =>
        prev.map((ch) => (ch._id === id ? { ...ch, unreadCount: raw } : ch)),
      );
    }
  }, [active]);

  const handleSelectContact = (contact: Contact) => {
    clearMention(contact._id);
    const storeMuted = isConversationMuted("dm", contact._id);

    onSelect({
      type: "dm",
      contact: { ...contact, isMuted: storeMuted, unreadCount: 0 },
    });
    setSearchTerm("");
    setSearchResults([]);
    setContacts((prev) => {
      const exists = prev.some((c) => c._id === contact._id);
      if (exists) {
        return prev.map((c) =>
          c._id === contact._id
            ? { ...c, isMuted: storeMuted, unreadCount: 0 }
            : c,
        );
      }
      return [
        { ...contact, isMuted: storeMuted, unreadCount: 0 },
        ...prev,
      ];
    });
  };

  const handleSelectChannel = (channel: Channel) => {
    clearMention(channel._id);
    const storeMuted = isConversationMuted("channel", channel._id);
    onSelect({
      type: "channel",
      channel: { ...channel, isMuted: storeMuted, unreadCount: 0 },
    });
    setChannels((prev) =>
      prev.map((ch) =>
        ch._id === channel._id
          ? { ...ch, isMuted: storeMuted, unreadCount: 0 }
          : ch,
      ),
    );
  };

  const handleChannelContextMenu = (e: React.MouseEvent, channel: Channel) => {
    e.preventDefault(); e.stopPropagation();
    const count = channelMemberCount(channel);
    setContextMenu({
      kind: "channel",
      id: channel._id,
      name: channel.name,
      subtitle: channelMemberCountLabel(count),
      isMuted: !!channel.isMuted,
      x: e.clientX,
      y: e.clientY,
      channel,
    });
  };

  const handleContactContextMenu = (e: React.MouseEvent, contact: Contact) => {
    e.preventDefault(); e.stopPropagation();
    const live = { ...contact, ...(getPresenceSnapshot(contact._id) ?? {}) };
    const status = getEffectiveStatus(live);
    const statusLabel = availabilityStatusLabel(status);
    setContextMenu({
      kind: "dm",
      id: contact._id,
      name: userLabel(contact),
      subtitle: contact.username ? `@${contact.username} · ${statusLabel}` : statusLabel,
      isMuted: !!contact.isMuted,
      x: e.clientX,
      y: e.clientY,
      contact,
    });
  };

  const handleToggleMute = async () => {
    if (!contextMenu) return;
    const { kind, id } = contextMenu;
    setContextMenu(null);
    try {
      if (kind === "dm") {
        const res = await toggleContactMute(id);
        const nextContacts = contacts.map((c) =>
          c._id === id
            ? {
                ...c,
                isMuted: res.isMuted,
                ...(res.isMuted ? { unreadCount: 0 } : {}),
              }
            : c,
        );
        setContacts(nextContacts);

        const nextMuted = new Set(getMutedConversationKeys());
        if (res.isMuted) nextMuted.add(`dm:${id}`);
        else nextMuted.delete(`dm:${id}`);
        setMutedConversationKeys(nextMuted, { broadcast: true });
        if (res.isMuted) rawUnreadRef.current.set(`dm:${id}`, 0);
        if (!res.isMuted) {

          if (refreshInFlightRef.current) await refreshInFlightRef.current;
          await refresh();
        }
      } else {
        const res = await toggleChannelMute(id);
        const nextChannels = channels.map((ch) =>
          ch._id === id
            ? {
                ...ch,
                isMuted: res.isMuted,
                ...(res.isMuted ? { unreadCount: 0 } : {}),
              }
            : ch,
        );
        setChannels(nextChannels);
        const nextMuted = new Set(getMutedConversationKeys());
        if (res.isMuted) nextMuted.add(`channel:${id}`);
        else nextMuted.delete(`channel:${id}`);
        setMutedConversationKeys(nextMuted, { broadcast: true });
        if (res.isMuted) rawUnreadRef.current.set(`channel:${id}`, 0);
        if (!res.isMuted) {
          if (refreshInFlightRef.current) await refreshInFlightRef.current;
          await refresh();
        }
      }

      clearMention(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sidebar.toast.muteFailed"));
    }
  };

  const handleChannelAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadAvatarChannel) {
      setUploadAvatarChannel(null);
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error(t("upload.avatarTooLarge", { limit: MAX_AVATAR_SIZE_LABEL }));
      setUploadAvatarChannel(null);
      return;
    }
    setChannelCropFile(file);
  };

  const handleChannelCropConfirm = async (file: File) => {
    await handleChannelAvatarChange(file);
  };

  contactsSnapshotRef.current = contacts;
  channelsSnapshotRef.current = channels;

  useEffect(() => {
    try {
      const activeKey =
        (active?.type === "dm"
          ? `dm:${active.contact._id}`
          : active?.type === "channel"
            ? `channel:${active.channel._id}`
            : null) ?? getActiveConversationKey();

      if (
        rawUnreadRef.current.size === 0 &&
        contacts.length === 0 &&
        channels.length === 0
      ) {
        return;
      }
      const pendingZero = new Set(peekPendingMarkReadKeys());
      let full = 0;
      let activeUnread = 0;
      if (rawUnreadRef.current.size === 0) {
        for (const c of contacts) {
          const key = `dm:${c._id}`;
          if (c.isMuted || isConversationMuted("dm", c._id) || pendingZero.has(key))
            continue;
          const n = Math.max(0, c.unreadCount ?? 0);
          full += n;
          if (activeKey === key) activeUnread = n;
        }
        for (const ch of channels) {
          const key = `channel:${ch._id}`;
          if (
            ch.isMuted ||
            isConversationMuted("channel", ch._id) ||
            pendingZero.has(key)
          )
            continue;
          const n = Math.max(0, ch.unreadCount ?? 0);
          full += n;
          if (activeKey === key) activeUnread = n;
        }
      } else {
        for (const [key, n] of rawUnreadRef.current) {
          const kind = key.startsWith("dm:") ? "dm" : "channel";
          const id = key.slice(key.indexOf(":") + 1);
          if (isConversationMuted(kind, id) || pendingZero.has(key)) continue;
          const v = Math.max(0, n);
          full += v;
          if (key === activeKey) activeUnread = v;
        }
      }
      unreadSync.setCountAndLocalExclude(full, activeUnread);
    } catch {
      // ignore
    }
  }, [contacts, channels, active, pendingMarkEpoch]);

  useEffect(
    () =>
      subscribePendingMarkReads(() => {
        setPendingMarkEpoch((n) => n + 1);
      }),
    [],
  );
  useEffect(
    () =>
      subscribeActiveConversation(() => {
        setPendingMarkEpoch((n) => n + 1);
      }),
    [],
  );

  const openChats = useCallback(() => {
    setContactsModalOpen(false);
    setContactsModalClosing(false);
  }, []);
  const pendingZeroNav = new Set(peekPendingMarkReadKeys());
  const activeNavKey =
    active?.type === "dm"
      ? `dm:${active.contact._id}`
      : active?.type === "channel"
        ? `channel:${active.channel._id}`
        : null;
  const totalUnread =
    contacts.reduce((s, c) => {
      const key = `dm:${c._id}`;
      if (
        key === activeNavKey ||
        isConversationMuted("dm", c._id) ||
        pendingZeroNav.has(key)
      )
        return s;
      return s + Math.max(0, c.unreadCount ?? 0);
    }, 0) +
    channels.reduce((s, ch) => {
      const key = `channel:${ch._id}`;
      if (
        key === activeNavKey ||
        isConversationMuted("channel", ch._id) ||
        pendingZeroNav.has(key)
      )
        return s;
      return s + Math.max(0, ch.unreadCount ?? 0);
    }, 0);

  return (
    <>
      <div className="app-shell app-shell--chat app-shell--no-detail">
        <div className="app-shell__nav">
          <Nav
            onOpenChats={openChats}
            settingsActive={false}
            onOpenSettings={() => navigate(settingsPath())}
            onOpenProfile={() => setProfileOpen(true)}
            onOpenContacts={() => {
              setContactsModalClosing(false);
              setContactsModalOpen(true);
            }}
            totalUnread={totalUnread}
          />
        </div>

        <div className="app-shell__list">
          <ChatList
            contacts={displayContacts}
            channels={channels}
            active={active}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            searchResults={searchResults}
            activeTab={chatListTab}
            onTabChange={setChatListTab}
            mentionSources={mentionSources}
            onSelectContact={(c) => {
              handleSelectContact(c);
            }}
            onSelectChannel={(ch) => {
              handleSelectChannel(ch);
            }}
            onContactContextMenu={handleContactContextMenu}
            onChannelContextMenu={handleChannelContextMenu}
            onNewChannel={() => {
              setNewChannelClosing(false);
              setShowNewChannel(true);
            }}
          />
        </div>
        <div className="app-shell__main">
          {isValidElement(children)
            ? cloneElement(children, {
                onOpenChannelSettings: (channel: Channel) => {
                  setChannelSettingsInfo({
                    channelId: channel._id,
                    channelName: channel.name,
                    channel,
                  });
                },
                onRemoveContact: (contact: Contact) => setRemoveContactInfo(contact),
              })
            : children}
        </div>
      </div>

      <MyProfile
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onOpenSettings={() => navigate(settingsPath())}
      />
      <OtherProfile
        isOpen={contactProfileOpen}
        openKey={contactProfileOpenKey}
        onClose={() => {
          setContactProfileOpen(false);
          setContactProfile(null);
        }}
        user={
          contactProfile
            ? {
                ...contactProfile,
                ...(getPresenceSnapshot(contactProfile._id) ?? {}),
              }
            : null
        }
        isFriend
        isBlockedByMe={Boolean(contactProfile?.isBlockedByMe)}
        onToggleBlock={
          contactProfile
            ? async () => {
                const res = await toggleContactBlock(contactProfile._id);
                invalidateFriendshipCache(contactProfile._id);
                setContactProfile({ ...contactProfile, isBlockedByMe: res.isBlocked });
                void refresh();
              }
            : undefined
        }
        onRemove={
          contactProfile
            ? () => setRemoveContactInfo(contactProfile)
            : undefined
        }
      />
      {(contactsModalOpen || contactsModalClosing) && (
        <Contacts
          isOpen={contactsModalOpen}
          isClosing={contactsModalClosing}
          onClose={handleCloseContactsModal}
          onSelectContact={(c) => {
            handleSelectContact(c);
            handleCloseContactsModal();
          }}
          onRefreshContacts={refresh}
        />
      )}

      {contextMenu && (
        <div
          ref={menuRef}
          className="chat-ctx klovy-ctx-in"
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 280),
            left: Math.min(contextMenu.x, window.innerWidth - 240),
          }}
        >
          <div className="chat-ctx__head">
            {contextMenu.kind === "dm" && contextMenu.contact ? (
              <Avatar
                displayName={contextMenu.contact.displayName}
                username={contextMenu.contact.username}
                image={contextMenu.contact.image}
                color={contextMenu.contact.color}
                size={36}
              />
            ) : contextMenu.channel ? (
              <Avatar
                displayName={contextMenu.channel.name}
                image={contextMenu.channel.image}
                placeholder="#"
                size={36}
              />
            ) : null}
            <div className="chat-ctx__meta">
              <div className="chat-ctx__name">{contextMenu.name}</div>
              <div className="chat-ctx__sub">{contextMenu.subtitle}</div>
            </div>
          </div>

          <button type="button" className="chat-ctx__item" onClick={handleToggleMute}>
            {contextMenu.isMuted ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-9.33-5" />
                <path d="M6 8v.01" />
                <path d="M5.93 6.32A5.93 5.93 0 0 0 6 8c0 7-3 9-3 9h13.73" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                <path d="M18.63 13A17.89 17.89 0 0 1 18 8" />
                <path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14" />
                <path d="M18 8a6 6 0 0 0-9.33-5" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            )}
            {contextMenu.isMuted ? t("chat.notifications.unmute") : t("chat.notifications.mute")}
          </button>

          {contextMenu.kind === "dm" && contextMenu.contact && (
            <>
              <div className="chat-ctx__sep" />
              <button
                type="button"
                className="chat-ctx__item"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  const contact = contextMenu.contact;
                  if (!contact) return;
                  setContextMenu(null);
                  setContactProfile({ ...contact });
                  setContactProfileOpenKey((key) => key + 1);
                  setContactProfileOpen(true);
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
                </svg>
                {t("sidebar.context.viewProfile")}
              </button>
              <button
                type="button"
                className="chat-ctx__item chat-ctx__item--danger"
                onClick={() => {
                  setRemoveContactInfo(contextMenu.contact!);
                  setContextMenu(null);
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="17" y1="11" x2="23" y2="11" />
                </svg>
                {t("sidebar.context.removeContact")}
              </button>
            </>
          )}

          {contextMenu.kind === "channel" && (
            <>
              <div className="chat-ctx__sep" />
              <button
                type="button"
                className="chat-ctx__item"
                onClick={() => {
                  const channel = contextMenu.channel ?? channels.find((c) => c._id === contextMenu.id);
                  if (channel) {
                    setChannelSettingsInfo({
                      channelId: contextMenu.id,
                      channelName: contextMenu.name,
                      channel,
                    });
                  }
                  setContextMenu(null);
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                {t("sidebar.context.channelSettings")}
              </button>
              {(() => {
                const ch = contextMenu.channel ?? channels.find((c) => c._id === contextMenu.id);
                const isOwner = ch && user && String(ch.admin._id) === String(user.id);
                if (!isOwner) return null;
                return (
                  <button
                    type="button"
                    className="chat-ctx__item chat-ctx__item--danger"
                    onClick={() => {
                      setDeleteChannelInfo({ channelId: contextMenu.id, channelName: contextMenu.name });
                      setContextMenu(null);
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
                    </svg>
                    {t("sidebar.context.deleteChannel")}
                  </button>
                );
              })()}
            </>
          )}
        </div>
      )}

      {channelSettingsInfo && user && (
        <ChannelSettings
          channel={channelSettingsInfo.channel}
          currentUserId={user.id}
          onClose={() => setChannelSettingsInfo(null)}
          onRefresh={refresh}
          onEdit={() => {
            setChannelSettingsInfo(null);
            setRenameChannelInfo({
              channelId: channelSettingsInfo.channelId,
              channelName: channelSettingsInfo.channelName,
            });
            setRenameChannelName(channelSettingsInfo.channelName);
          }}
          onDelete={() => {
            setChannelSettingsInfo(null);
            setDeleteChannelInfo({
              channelId: channelSettingsInfo.channelId,
              channelName: channelSettingsInfo.channelName,
            });
          }}
          onLeaveComplete={() => {
            if (active?.type === "channel" && active.channel._id === channelSettingsInfo.channelId) {
              onSelect(null);
            }
          }}
        />
      )}

      {(showNewChannel || newChannelClosing) && (
        <div
          className={`klovy-backdrop klovy-backdrop--center${newChannelClosing ? " closing" : ""}`}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseNewChannel(); }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className={`klovy-shell${newChannelClosing ? " closing" : ""}`}
            style={{ ...modalCard, animation: "none" }}
          >
            <div style={modalHeader}>
              <div>
                <p style={modalTitle}>{t("sidebar.modals.newChannel.title")}</p>
                <p style={modalSubtitle}>{t("sidebar.modals.newChannel.hint")}</p>
              </div>
              <HoverBtn type="button" style={closeBtn} hoverStyle={{ background: C.bgHover, color: C.text }} aria-label={t("common.close")} onClick={() => handleCloseNewChannel()}>×</HoverBtn>
            </div>
            <div style={modalBody}>
              <label style={fieldLabel}>{t("sidebar.modals.newChannel.nameLabel")}</label>
              <input ref={channelInputRef} style={textInput} value={channelName}
                maxLength={50}
                minLength={3}
                onChange={(e) => setChannelName(e.target.value.slice(0, 50))}
                placeholder={t("sidebar.modals.newChannel.namePlaceholder")}
                onKeyDown={(e) => e.key === "Enter" && handleNewChannel()}
                onFocus={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = "#141414"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bgDeep; }}
              />
            </div>
            <div style={modalFooter}>
              <HoverBtn type="button" style={btnSecondary} hoverStyle={{ background: C.bgHover, color: C.text }} onClick={() => handleCloseNewChannel()}>{t("common.cancel")}</HoverBtn>
              <HoverBtn type="button" style={btnPrimary} hoverStyle={{ background: C.accentHover }} onClick={handleNewChannel}>{t("sidebar.modals.newChannel.submit")}</HoverBtn>
            </div>
          </div>
        </div>
      )}

      {(renameChannelInfo || renameChannelClosing) && (
        <div
          className={`klovy-backdrop klovy-backdrop--center${renameChannelClosing ? " closing" : ""}`}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseRenameChannel(); }}
          role="dialog"
          aria-modal="true"
        >
          <div className="klovy-shell" style={modalCard}>
            <div style={modalHeader}>
              <div>
                <p style={modalTitle}>{t("sidebar.modals.renameChannel.title")}</p>
                <p style={modalSubtitle}>{t("sidebar.modals.renameChannel.currentLabel", { name: renameChannelInfo?.channelName ?? "" })}</p>
              </div>
              <HoverBtn type="button" style={closeBtn} hoverStyle={{ background: C.bgHover, color: C.text }} aria-label={t("common.close")} onClick={handleCloseRenameChannel}>×</HoverBtn>
            </div>
            <div style={modalBody}>
              <label style={fieldLabel}>{t("sidebar.modals.renameChannel.newNameLabel")}</label>
              <input ref={channelInputRef} style={textInput} value={renameChannelName}
                onChange={(e) => setRenameChannelName(e.target.value)}
                placeholder={t("sidebar.modals.renameChannel.placeholder")}
                onKeyDown={(e) => e.key === "Enter" && handleRenameChannel()}
                onFocus={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.background = "#141414"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.bgDeep; }}
              />
            </div>
            <div style={modalFooter}>
              <HoverBtn type="button" style={btnSecondary} hoverStyle={{ background: C.bgHover, color: C.text }} onClick={handleCloseRenameChannel}>{t("common.cancel")}</HoverBtn>
              <HoverBtn type="button" style={btnPrimary} hoverStyle={{ background: C.accentHover }} onClick={handleRenameChannel}>{t("sidebar.modals.renameChannel.submit")}</HoverBtn>
            </div>
          </div>
        </div>
      )}

      {(removeContactInfo || removeContactClosing) && (
        <div
          className={`klovy-backdrop${removeContactClosing ? " closing" : ""}`}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseRemoveContact(); }}
          role="dialog"
          aria-modal="true"
        >
          <div className="klovy-shell" style={modalCard}>
            <div style={modalHeader}>
              <div>
                <p style={modalTitle}>{t("sidebar.modals.removeContact.title")}</p>
                <p style={modalSubtitle}>{t("sidebar.modals.removeContact.subtitle")}</p>
              </div>
              <HoverBtn type="button" style={closeBtn} hoverStyle={{ background: C.bgHover, color: C.text }} aria-label={t("common.close")} onClick={handleCloseRemoveContact}>×</HoverBtn>
            </div>
            <div style={modalBody}>
              <div style={{
                background: C.dangerDim, border: `1px solid ${C.dangerBorder}`,
                borderRadius: 10, padding: "14px 16px",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <p style={{ margin: 0, fontSize: "0.84rem", color: "#fca5a5", lineHeight: 1.6 }}>
                  {t("sidebar.modals.removeContact.confirmWithName", { name: userLabel(removeContactInfo!) })}{" "}
                  {t("sidebar.modals.removeContact.historyDeleted")}
                </p>
              </div>
            </div>
            <div style={modalFooter}>
              <HoverBtn type="button" style={btnSecondary} hoverStyle={{ background: C.bgHover, color: C.text }} disabled={removeContactSending} onClick={handleCloseRemoveContact}>{t("common.cancel")}</HoverBtn>
              <HoverBtn type="button" style={btnDanger} hoverStyle={{ background: "#dc2626" }} disabled={removeContactSending} onClick={() => void handleRemoveContact()}>
                {removeContactSending ? t("common.removing") : t("sidebar.modals.removeContact.submit")}
              </HoverBtn>
            </div>
          </div>
        </div>
      )}

      {(deleteChannelInfo || deleteChannelClosing) && (
        <div
          className={`klovy-backdrop${deleteChannelClosing ? " closing" : ""}`}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseDeleteChannel(); }}
          role="dialog"
          aria-modal="true"
        >
          <div className="klovy-shell" style={modalCard}>
            <div style={modalHeader}>
              <div>
                <p style={modalTitle}>{t("sidebar.modals.deleteChannel.title")}</p>
                <p style={modalSubtitle}>{t("sidebar.modals.deleteChannel.subtitle")}</p>
              </div>
              <HoverBtn type="button" style={closeBtn} hoverStyle={{ background: C.bgHover, color: C.text }} aria-label={t("common.close")} onClick={handleCloseDeleteChannel}>×</HoverBtn>
            </div>
            <div style={modalBody}>
              <div style={{
                background: C.dangerDim, border: `1px solid ${C.dangerBorder}`,
                borderRadius: 10, padding: "14px 16px",
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.danger} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <p style={{ margin: 0, fontSize: "0.84rem", color: "#fca5a5", lineHeight: 1.6 }}>
                  {t("sidebar.modals.deleteChannel.confirmWithName", { name: deleteChannelInfo?.channelName ?? "" })}{" "}
                  {t("sidebar.modals.deleteChannel.messagesDeleted")}
                </p>
              </div>
            </div>
            <div style={modalFooter}>
              <HoverBtn type="button" style={btnSecondary} hoverStyle={{ background: C.bgHover, color: C.text }} onClick={handleCloseDeleteChannel}>{t("common.cancel")}</HoverBtn>
              <HoverBtn type="button" style={btnDanger} hoverStyle={{ background: "#dc2626" }} onClick={handleDeleteChannel}>{t("sidebar.modals.deleteChannel.submit")}</HoverBtn>
            </div>
          </div>
        </div>
      )}

      {mentionToast && (
        <div
          className="mention-toast"
          role="button"
          tabIndex={0}
          onClick={openMentionFromToast}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openMentionFromToast();
            }
          }}
        >
          <span className="mention-toast__at">@</span>
          <Avatar
            displayName={mentionToast.from?.displayName}
            username={mentionToast.from?.username}
            image={mentionToast.from?.image ?? null}
            color={mentionToast.from?.color}
            size={36}
          />
          <div className="mention-toast__body">
            <div className="mention-toast__title">
              {userLabel(mentionToast.from ?? {})}
              <span className="mention-toast__where">
                {mentionToast.scope === "channel"
                  ? t("chat.mentionToast.inChannel", { name: mentionToast.sourceName ?? t("common.channel") })
                  : t("chat.mentionToast.mentionedYou")}
              </span>
            </div>
            {mentionToast.preview && (
              <div className="mention-toast__preview">{mentionToast.preview}</div>
            )}
          </div>
          <button
            type="button"
            className="mention-toast__close"
            aria-label={t("common.close")}
            onClick={(e) => {
              e.stopPropagation();
              setMentionToast(null);
            }}
          >
            ×
          </button>
        </div>
      )}

      <input ref={channelAvatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleChannelAvatarFileChange} />

      {channelCropFile ? (
        <ImageCrop
          file={channelCropFile}
          aspect={1}
          outputWidth={512}
          outputHeight={512}
          round
          title={t("imageCrop.channelAvatarTitle")}
          maxSizeLabel={MAX_AVATAR_SIZE_LABEL}
          busy={channelAvatarUploading}
          onCancel={() => {
            setChannelCropFile(null);
            setUploadAvatarChannel(null);
          }}
          onConfirm={handleChannelCropConfirm}
        />
      ) : null}
    </>
  );
}
