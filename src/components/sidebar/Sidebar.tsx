import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getContactsForList, searchContacts, toggleContactMute, toggleContactBlock } from "../../api/contacts";
import { removeFriend } from "../../api/friends";
import {
  getUserChannels,
  createChannel,
  renameChannel,
  uploadChannelAvatar,
  deleteChannel,
  toggleChannelMute,
} from "../../api/channels";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useWebSocket } from "../../context/WebSocketContext";
import { WsType } from "../../api/wsProtocol";
import { Avatar } from "../common/Avatar";
import unreadSync from "../../utils/sync/unreadSync";
import { playNotificationSound } from "../../utils/media/notificationSound";
import { AccountSettingsModal } from "../../pages/AccountSettingsModal";
import { AppNavRail } from "../layout/AppNavRail";
import { ChatListPane, type ChatListTab } from "../layout/ChatListPane";
import { MobileShellBar, type ShellOverlay } from "../layout/MobileShellBar";
import { UserProfileModal } from "../profile/UserProfileModal";
import { OtherUserProfileModal } from "../profile/OtherUserProfileModal";
import { userLabel, availabilityStatusLabel } from "../../utils/user/format";
import { channelMemberCount, channelMemberCountLabel } from "../../utils/user/presence";
import { useProfileSync } from "../../hooks/useProfileSync";
import { useListeningSync } from "../../hooks/useListeningSync";
import { useSpotifyListeningSync } from "../../hooks/useSpotifyListeningSync";
import { notifySpotifyConnectionChanged } from "../../utils/sync/spotifyConnectionSync";
import type { Channel, ChatTarget, Contact, Message } from "../../types";
import { ChannelSettingsModal } from "../channel/ChannelSettingsModal";
import { ContactsModal } from "../contacts/ContactsModal";
import { AdminPanelModal } from "../admin/AdminPanelModal";
import "../../styles/chat/chat-context-menu.css";

/* ─── design tokens (mirror global.css vars) ─── */
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

/* ─── inline style helpers ─── */
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

/* ─── Hover button helper ─── */
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

/* ─── Constants ─── */

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

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);

  // Refy z aktualnymi listami i id zalogowanego użytkownika — pozwalają
  // handlerom WebSocket (rejestrowanym raz) sprawdzić stan wyciszenia bez
  // ponownego podpinania nasłuchiwaczy przy każdej zmianie.
  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const currentUserIdRef = useRef(user?.id);
  currentUserIdRef.current = user?.id;

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

  const [channelSettingsInfo, setChannelSettingsInfo] = useState<{
    channelId: string; channelName: string; channel: Channel;
  } | null>(null);

  const [settingsInitialSection, setSettingsInitialSection] = useState<
    "profil" | "konto" | "sesje" | "glos" | "boty" | "integracje" | "ostrzezenia" | undefined
  >(undefined);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsShellOverlay, setSettingsShellOverlay] = useState<ShellOverlay>(null);
  const [chatListTab, setChatListTab] = useState<ChatListTab>("dm");
  const [shellOverlay, setShellOverlay] = useState<ShellOverlay>(null);
  const [spotifyOauthError, setSpotifyOauthError] = useState<string | null>(null);
  const [spotifyOauthConnected, setSpotifyOauthConnected] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [contactProfileOpen, setContactProfileOpen] = useState(false);
  const [contactProfile, setContactProfile] = useState<Contact | null>(null);
  const [contactsModalOpen, setContactsModalOpen] = useState(false);
  const [contactsModalClosing, setContactsModalClosing] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminModalClosing, setAdminModalClosing] = useState(false);
  const [removeContactInfo, setRemoveContactInfo] = useState<Contact | null>(null);
  const [removeContactClosing, setRemoveContactClosing] = useState(false);
  const [removeContactSending, setRemoveContactSending] = useState(false);

  const [mentionSources, setMentionSources] = useState<Set<string>>(new Set());
  const [mentionToast, setMentionToast] = useState<MentionToast | null>(null);
  const mentionToastTimeout = useRef<ReturnType<typeof setTimeout>>();

  const channelInputRef = useRef<HTMLInputElement>(null);
  const channelAvatarInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  /* data */
  const refresh = useCallback(async () => {
    try {
      const [contactsRes, channelsRes] = await Promise.all([getContactsForList(), getUserChannels()]);
      setContacts(contactsRes.contacts); setChannels(channelsRes.channels);
    } catch { /**/ }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const applyUnreadUpdate = useCallback(
    (payload: { type: "dm" | "channel"; id: string; unreadCount: number }) => {
      if (payload.type === "dm") {
        setContacts((prev) =>
          prev.map((c) =>
            c._id === payload.id ? { ...c, unreadCount: payload.unreadCount } : c,
          ),
        );
        return;
      }

      setChannels((prev) =>
        prev.map((ch) =>
          ch._id === payload.id ? { ...ch, unreadCount: payload.unreadCount } : ch,
        ),
      );
    },
    [],
  );

  const handleRemoveContact = async () => {
    if (!removeContactInfo) return;
    setRemoveContactSending(true);
    try {
      await removeFriend(removeContactInfo._id);
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

  const handleCloseAdminModal = () => {
    if (adminModalClosing) return;
    setAdminModalClosing(true);
    window.setTimeout(() => {
      setAdminModalOpen(false);
      setAdminModalClosing(false);
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

  /* WebSocket */
  useEffect(() => {
    if (!ws) return;
    const onRenamed = (e: { channelId: string; name: string }) => {
      setChannels((p) => p.map((ch) => ch._id === e.channelId ? { ...ch, name: e.name } : ch));
      if (active?.type === "channel" && active.channel._id === e.channelId)
        onSelect({ type: "channel", channel: { ...active.channel, name: e.name } });
    };
    const onDeleted = (e: { channelId: string }) => {
      setChannels((p) => p.filter((ch) => ch._id !== e.channelId));
      if (active?.type === "channel" && active.channel._id === e.channelId) onSelect(null);
    };
    const onAvatarUpdated = (e: { channelId: string; image: string }) => {
      setChannels((p) => p.map((ch) => ch._id === e.channelId ? { ...ch, image: e.image } : ch));
      if (active?.type === "channel" && active.channel._id === e.channelId)
        onSelect({ type: "channel", channel: { ...active.channel, image: e.image } });
    };
    const onSlowmodeUpdated = (e: { channelId: string; rateLimitPerUser: number }) => {
      setChannels((p) => p.map((ch) => ch._id === e.channelId ? { ...ch, rateLimitPerUser: e.rateLimitPerUser } : ch));
      if (active?.type === "channel" && active.channel._id === e.channelId)
        onSelect({ type: "channel", channel: { ...active.channel, rateLimitPerUser: e.rateLimitPerUser } });
    };
    const onChatLockUpdated = (e: { channelId: string; chatLocked: boolean }) => {
      setChannels((p) => p.map((ch) => ch._id === e.channelId ? { ...ch, chatLocked: e.chatLocked } : ch));
      if (active?.type === "channel" && active.channel._id === e.channelId)
        onSelect({ type: "channel", channel: { ...active.channel, chatLocked: e.chatLocked } });
    };
    const onModerationUpdated = (e: { channelId: string; isMutedHere: boolean }) => {
      setChannels((p) => p.map((ch) => ch._id === e.channelId ? { ...ch, isMutedHere: e.isMutedHere } : ch));
      if (active?.type === "channel" && active.channel._id === e.channelId)
        onSelect({ type: "channel", channel: { ...active.channel, isMutedHere: e.isMutedHere } });
    };
    const onChannelAdded = () => { void refresh(); };
    const onChannelLeft = (e: { channelId: string }) => {
      setChannels((p) => p.filter((ch) => ch._id !== e.channelId));
      if (active?.type === "channel" && active.channel._id === e.channelId) onSelect(null);
      if (channelSettingsInfo?.channelId === e.channelId) setChannelSettingsInfo(null);
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
    ];
    return () => unsubs.forEach((u) => u());
  }, [ws, active, onSelect, refresh, channelSettingsInfo]);

  useEffect(() => {
    if (!ws) return;
    const syncContactPreviews = () => {
      void refresh();
    };
    const onUnreadUpdated = (payload: {
      type: "dm" | "channel";
      id: string;
      unreadCount: number;
    }) => {
      applyUnreadUpdate(payload);
    };

    const getSenderId = (msg: Message): string | undefined => {
      const s = msg?.sender;
      if (!s) return undefined;
      return typeof s === "string" ? s : s._id ?? s.id;
    };

    // Wiadomość DM od kogoś innego niż my, z kontaktu, którego nie wyciszyliśmy.
    const onDmMessage = (msg: Message) => {
      void refresh();
      const senderId = getSenderId(msg);
      if (!senderId || senderId === currentUserIdRef.current) return;
      const contact = contactsRef.current.find((c) => c._id === senderId);
      if (contact?.isMuted) return;
      playNotificationSound();
    };

    // Wiadomość kanałowa od kogoś innego, na kanale, którego nie wyciszyliśmy.
    const onChannelMessage = (msg: Message) => {
      void refresh();
      const senderId = getSenderId(msg);
      if (!senderId || senderId === currentUserIdRef.current) return;
      const channelId = msg?.channelId ?? msg?.channel;
      const channel = channelsRef.current.find((ch) => ch._id === channelId);
      if (channel?.isMuted) return;
      playNotificationSound();
    };
    const onUserStatusChanged = (payload: {
      userId: string;
      status: {
        isOnline: boolean;
        lastSeen?: string | number | null;
        availabilityStatus?: "online" | "away" | "brb" | "dnd";
      };
    }) => {
      const patch = (c: Contact): Contact =>
        c._id === payload.userId
          ? {
              ...c,
              isOnline: payload.status.isOnline,
              lastSeen: payload.status.lastSeen
                ? new Date(payload.status.lastSeen).toISOString()
                : c.lastSeen ?? null,
              availabilityStatus:
                payload.status.availabilityStatus ?? c.availabilityStatus ?? "online",
            }
          : c;
      setContacts((prev) => prev.map(patch));
      setContactProfile((prev) => (prev ? patch(prev) : prev));
      if (active?.type === "dm" && active.contact._id === payload.userId) {
        onSelect({ type: "dm", contact: patch(active.contact) });
      }
    };
    const unsubs = [
      ws.subscribe(WsType.MESSAGE_DELETED, syncContactPreviews),
      ws.subscribe(WsType.RECEIVE_MESSAGE, onDmMessage),
      ws.subscribe(WsType.RECEIVE_CHANNEL_MESSAGE, onChannelMessage),
      ws.subscribe(WsType.UNREAD_UPDATED, onUnreadUpdated),
      ws.subscribe(WsType.USER_STATUS_CHANGED, onUserStatusChanged),
    ];
    return () => unsubs.forEach((u) => u());
  }, [ws, refresh, applyUnreadUpdate, active, onSelect]);

  const clearMention = useCallback((sourceId: string) => {
    setMentionSources((prev) => {
      if (!prev.has(sourceId)) return prev;
      const next = new Set(prev);
      next.delete(sourceId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!ws) return;
    const onMention = (payload: MentionEvent) => {
      if (!payload?.sourceId) return;
      const viewing =
        (payload.scope === "dm" &&
          active?.type === "dm" &&
          active.contact._id === payload.sourceId) ||
        (payload.scope === "channel" &&
          active?.type === "channel" &&
          active.channel._id === payload.sourceId);
      if (viewing) return;

      setMentionSources((prev) => {
        const next = new Set(prev);
        next.add(payload.sourceId);
        return next;
      });
      setMentionToast({ ...payload, key: Date.now() });
    };
    const unsub = ws.subscribe(WsType.MESSAGE_MENTION, onMention);
    return () => unsub();
  }, [ws, active]);

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
      const contact = contacts.find((c) => c._id === mentionToast.sourceId);
      if (contact) {
        onSelect({ type: "dm", contact: { ...contact, unreadCount: 0 } });
      }
    } else {
      const channel = channels.find((ch) => ch._id === mentionToast.sourceId);
      if (channel) {
        onSelect({ type: "channel", channel: { ...channel, unreadCount: 0 } });
      }
    }
    clearMention(mentionToast.sourceId);
    setMentionToast(null);
  }, [mentionToast, contacts, channels, onSelect, clearMention]);

  useProfileSync(ws, {
    onInfo: ({ userId, username, displayName, bio, color }) =>
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
      ),
    onImage: ({ userId, image }) =>
      setContacts((prev) =>
        prev.map((c) => (c._id === userId ? { ...c, image } : c)),
      ),
    onBanner: ({ userId, banner }) =>
      setContacts((prev) =>
        prev.map((c) => (c._id === userId ? { ...c, banner } : c)),
      ),
  });

  useListeningSync(ws, {
    onListening: ({ userId, listeningActivity }) => {
      setContacts((prev) =>
        prev.map((c) =>
          c._id === userId ? { ...c, listeningActivity } : c,
        ),
      );
      setContactProfile((prev) =>
        prev && prev._id === userId ? { ...prev, listeningActivity } : prev,
      );
    },
  });

  useEffect(() => {
    if (!ws) return;
    const onBadgeUpdate = (payload: { userId: string; badges: Contact["badges"] }) => {
      if (!payload?.userId) return;
      const patch = (contact: Contact): Contact =>
        contact._id === payload.userId
          ? { ...contact, badges: payload.badges ?? [] }
          : contact;
      setContacts((prev) => prev.map(patch));
      setContactProfile((prev) => (prev ? patch(prev) : prev));
      if (active?.type === "dm" && active.contact._id === payload.userId) {
        onSelect({
          type: "dm",
          contact: patch(active.contact),
        });
      }
    };
    const unsubs = [
      ws.subscribe(WsType.BADGE_ASSIGNED, onBadgeUpdate),
      ws.subscribe(WsType.BADGE_REMOVED, onBadgeUpdate),
      ws.subscribe(WsType.BADGE_UPDATED, onBadgeUpdate),
    ];
    return () => unsubs.forEach((unsub) => unsub());
  }, [ws, active, onSelect]);

  useSpotifyListeningSync();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotify = params.get("spotify");
    if (spotify === "connected" || spotify === "error") {
      setSettingsInitialSection("integracje");
      setSettingsOpen(true);
      if (spotify === "connected") {
        setSpotifyOauthConnected(true);
        setSpotifyOauthError(null);
        notifySpotifyConnectionChanged();
      } else {
        const raw = params.get("message");
        setSpotifyOauthError(raw ? decodeURIComponent(raw) : t("sidebar.toast.spotifyFailed"));
        setSpotifyOauthConnected(false);
      }
      params.delete("spotify");
      params.delete("message");
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

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
    if (!contextMenu) return;
    const handleClick = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setContextMenu(null); };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") setContextMenu(null); };
    document.addEventListener("mousedown", handleClick); document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
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

  /* actions */
  const handleNewChannel = async () => {
    const name = channelName.trim(); if (!name) return;
    try {
      const { channel } = await createChannel(name);
      setChannelName("");
      handleCloseNewChannel(() => {
        refresh();
        onSelect({ type: "channel", channel });
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
      await refresh();
      if (active?.type === "channel" && active.channel._id === channelId)
        onSelect({ type: "channel", channel: { ...active.channel, name: updatedName } });
      handleCloseRenameChannel();
    } catch (err) { toast.error(err instanceof Error ? err.message : t("sidebar.toast.channelRenameFailed")); }
  };

  const handleChannelAvatarChange = async (file: File) => {
    if (!uploadAvatarChannel) return;
    try {
      const { image } = await uploadChannelAvatar(uploadAvatarChannel.channelId, file);
      setUploadAvatarChannel(null);
      setTimeout(() => { if (channelAvatarInputRef.current) channelAvatarInputRef.current.value = ""; }, 0);
      await refresh();
      if (active?.type === "channel" && active.channel._id === uploadAvatarChannel.channelId)
        onSelect({ type: "channel", channel: { ...active.channel, image } });
    } catch (err) { toast.error(err instanceof Error ? err.message : t("sidebar.toast.channelAvatarFailed")); }
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

  const handleSelectContact = (contact: Contact) => {
    clearMention(contact._id);
    onSelect({ type: "dm", contact: { ...contact, unreadCount: 0 } });
    setSearchTerm("");
    setSearchResults([]);
    setContacts((prev) => {
      const exists = prev.some((c) => c._id === contact._id);
      if (exists) {
        return prev.map((c) =>
          c._id === contact._id ? { ...c, unreadCount: 0 } : c,
        );
      }
      return [{ ...contact, unreadCount: 0 }, ...prev];
    });
  };

  const handleSelectChannel = (channel: Channel) => {
    clearMention(channel._id);
    onSelect({ type: "channel", channel: { ...channel, unreadCount: 0 } });
    setChannels((prev) =>
      prev.map((ch) =>
        ch._id === channel._id ? { ...ch, unreadCount: 0 } : ch,
      ),
    );
  };

  const getEffectiveStatus = (entity: {
    isOnline?: boolean;
    availabilityStatus?: "online" | "away" | "brb" | "dnd";
  }) => (entity.isOnline ? (entity.availabilityStatus ?? "online") : "offline");

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
    const status = getEffectiveStatus(contact);
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
        setContacts((prev) =>
          prev.map((c) => (c._id === id ? { ...c, isMuted: res.isMuted } : c)),
        );
      } else {
        const res = await toggleChannelMute(id);
        setChannels((prev) =>
          prev.map((ch) => (ch._id === id ? { ...ch, isMuted: res.isMuted } : ch)),
        );
      }
      // Po wyciszeniu usuń ewentualny znacznik wzmianki dla tej konwersacji.
      clearMention(id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("sidebar.toast.muteFailed"));
    }
  };

  const handleChannelAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadAvatarChannel) { setUploadAvatarChannel(null); return; }
    handleChannelAvatarChange(file);
  };

  /* sync total unread across tabs */
  useEffect(() => {
    try {
      const total = contacts.reduce((s, c) => s + (c.isMuted ? 0 : (c.unreadCount ?? 0)), 0) + channels.reduce((s, ch) => s + (ch.isMuted ? 0 : (ch.unreadCount ?? 0)), 0);
      unreadSync.setCount(total);
    } catch {
      // ignore
    }
  }, [contacts, channels]);

  /* ─── context menu ─── */
  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsInitialSection(undefined);
    setSettingsShellOverlay(null);
    setSpotifyOauthError(null);
    setSpotifyOauthConnected(false);
  }, []);

  useEffect(() => {
    if (!settingsOpen && !shellOverlay && !settingsShellOverlay) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (settingsOpen) {
        if (settingsShellOverlay) {
          setSettingsShellOverlay(null);
          return;
        }
        closeSettings();
        return;
      }
      setShellOverlay(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [settingsOpen, settingsShellOverlay, shellOverlay, closeSettings]);

  useEffect(() => {
    if (settingsOpen) return;
    setShellOverlay(null);
  }, [active, settingsOpen]);

  const chatOverlayClass =
    shellOverlay === "nav" ? " app-shell--overlay-nav"
    : shellOverlay === "list" ? " app-shell--overlay-list"
    : "";

  const settingsOverlayClass =
    settingsShellOverlay === "nav" ? " app-shell--overlay-nav"
    : settingsShellOverlay === "settings-nav" ? " app-shell--overlay-settings-nav"
    : "";

  const shellClass = settingsOpen
    ? `app-shell app-shell--settings${settingsOverlayClass}`
    : `app-shell app-shell--chat app-shell--no-detail${chatOverlayClass}`;

  const chatTitle =
    active?.type === "dm"
      ? userLabel(active.contact)
      : active?.type === "channel"
        ? active.channel.name
        : t("nav.brand.title");

  const totalUnread =
    contacts.reduce((s, c) => s + (c.isMuted ? 0 : (c.unreadCount ?? 0)), 0) +
    channels.reduce((s, ch) => s + (ch.isMuted ? 0 : (ch.unreadCount ?? 0)), 0);

  /* ───────────────────── JSX ───────────────────── */
  return (
    <>
      <div className={shellClass}>
        <button
          type="button"
          className="mobile-shell-scrim"
          aria-label={t("common.closePanel")}
          onClick={() => {
            setShellOverlay(null);
            setSettingsShellOverlay(null);
          }}
        />
        <div className="app-shell__nav">
          <AppNavRail
            onOpenSettings={() => {
              setSettingsShellOverlay(null);
              setSettingsOpen(true);
            }}
            onOpenContacts={() => {
              setContactsModalClosing(false);
              setContactsModalOpen(true);
            }}
            onOpenAdmin={() => {
              setAdminModalClosing(false);
              setAdminModalOpen(true);
            }}
            totalUnread={totalUnread}
          />
        </div>

        {settingsOpen ? (
          <div className="app-shell__settings-main">
            <MobileShellBar
              variant="settings"
              title={t("nav.items.settings")}
              overlay={settingsShellOverlay}
              onOverlayChange={setSettingsShellOverlay}
              onClose={closeSettings}
              showList={false}
            />
            <AccountSettingsModal
              inline
              initialSection={settingsInitialSection}
              spotifyOauthError={spotifyOauthError}
              spotifyOauthConnected={spotifyOauthConnected}
              onClose={closeSettings}
              onSectionChange={() => setSettingsShellOverlay(null)}
            />
          </div>
        ) : (
          <>
            <div className="app-shell__list">
              <ChatListPane
                contacts={contacts}
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
                  setShellOverlay(null);
                }}
                onSelectChannel={(ch) => {
                  handleSelectChannel(ch);
                  setShellOverlay(null);
                }}
                onContactContextMenu={handleContactContextMenu}
                onChannelContextMenu={handleChannelContextMenu}
                onNewChannel={() => {
                  setNewChannelClosing(false);
                  setShowNewChannel(true);
                }}
                getEffectiveStatus={getEffectiveStatus}
              />
            </div>
            <div className="app-shell__main">
              <MobileShellBar
                title={chatTitle}
                overlay={shellOverlay}
                onOverlayChange={setShellOverlay}
              />
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
          </>
        )}
      </div>

      {/* ═══════════════ ACCOUNT SETTINGS ═══════════════ */}
      <UserProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      <OtherUserProfileModal
        isOpen={contactProfileOpen}
        onClose={() => {
          setContactProfileOpen(false);
          setContactProfile(null);
        }}
        user={contactProfile}
        isFriend
        isBlockedByMe={Boolean(contactProfile?.isBlockedByMe)}
        onToggleBlock={
          contactProfile
            ? async () => {
                const res = await toggleContactBlock(contactProfile._id);
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
        <ContactsModal
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

      {(adminModalOpen || adminModalClosing) && (
        <AdminPanelModal
          isOpen={adminModalOpen}
          isClosing={adminModalClosing}
          onClose={handleCloseAdminModal}
        />
      )}

      {/* ═══════════════ CONTEXT MENU ═══════════════ */}
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
                onClick={() => {
                  setContactProfile(contextMenu.contact!);
                  setContactProfileOpen(true);
                  setContextMenu(null);
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
        <ChannelSettingsModal
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

      {/* ═══════════════ NEW CHANNEL MODAL ═══════════════ */}
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

      {/* ═══════════════ RENAME MODAL ═══════════════ */}
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

      {/* ═══════════════ REMOVE CONTACT CONFIRM ═══════════════ */}
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

      {/* ═══════════════ DELETE CONFIRM MODAL ═══════════════ */}
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

      {/* ═══════════════ MENTION TOAST ═══════════════ */}
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

      {/* Hidden avatar input */}
      <input ref={channelAvatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} onChange={handleChannelAvatarFileChange} />
    </>
  );
}