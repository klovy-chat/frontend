import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../i18n/config";
import {
  getChannelDetails,
  reportChannel,
  kickChannelMember,
  banChannelMember,
  unbanChannelMember,
  muteChannelMember,
  unmuteChannelMember,
  uploadChannelAvatar,
  removeChannelAvatar,
  updateChannelSlowmode,
  updateChannelChatLock,
  leaveChannel,
  type ChannelModerationResponse,
} from "../../api/channels";
import {
  createChannelInvite,
  deleteChannelInvite,
  listChannelInvites,
  type ChannelInvite,
} from "../../api/invites";
import { checkFriendship } from "../../api/friends";
import { ActionMenu, type ActionMenuItem } from "../common/ActionMenu";
import { Ban, UserMinus, Volume2, VolumeX } from "lucide-react";
import { ImageCropModal } from "../common/ImageCropModal";
import { OtherUserProfileModal } from "../profile/OtherUserProfileModal";
import {
  MAX_AVATAR_SIZE_BYTES,
  MAX_AVATAR_SIZE_LABEL,
} from "../../constants/upload";
import { Avatar } from "../common/Avatar";
import {
  bumpPublicMediaCache,
  bumpPublicMediaCacheForChannel,
} from "../../utils/media/cdnCacheVersion";
import { userLabel } from "../../utils/user/format";
import { mapChannelUser, mapChannelUserList } from "../../utils/chat/channelUser";
import {
  CHANNEL_MOD_DURATION_OPTIONS,
  formatModerationExpiry,
} from "../../utils/chat/channelModeration";
import type { Channel, ChannelDetails, Contact } from "../../types";
import { useToast } from "../../context/ToastContext";
import "../../styles/channel/channel-settings.css";

const C = {
  bgDeep: "var(--bg-deep)",
  bgPanel: "var(--bg-panel)",
  bgHover: "var(--bg-hover)",
  border: "var(--border)",
  borderLight: "var(--border-light)",
  text: "var(--text)",
  textMuted: "var(--text-muted)",
  textDim: "var(--text-dim)",
  accent: "var(--accent)",
  accentHover: "var(--accent-hover)",
  accentDim: "var(--accent-dim)",
  accentBorder: "var(--accent-border)",
  danger: "var(--danger)",
  dangerDim: "var(--danger-dim)",
  dangerBorder: "var(--danger-border)",
};

const modalCard: React.CSSProperties = {
  background: C.bgPanel,
  border: `1px solid ${C.border}`,
  borderRadius: 16,
  boxShadow: "0 32px 80px rgba(0,0,0,0.65)",
  overflow: "hidden",
};

const confirmModalCard: React.CSSProperties = {
  ...modalCard,
  width: 440,
  maxWidth: "95vw",
};

const modalHeader: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  padding: "24px 24px 0",
};

const modalTitle: React.CSSProperties = {
  margin: 0,
  fontSize: "1.05rem",
  fontWeight: 700,
  color: C.text,
  letterSpacing: "-0.01em",
  fontFamily: "var(--font-sans)",
};

const modalSubtitle: React.CSSProperties = {
  margin: "4px 0 0",
  fontSize: "0.8rem",
  color: C.textMuted,
  lineHeight: 1.5,
  fontFamily: "var(--font-sans)",
};

const modalBody: React.CSSProperties = {
  padding: "20px 24px",
};

const modalFooter: React.CSSProperties = {
  padding: "0 24px 22px",
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
};

const REPORT_REASON_KEYS = [
  "spam",
  "offensive",
  "harassment",
  "illegal",
  "impersonation",
  "other",
] as const;

type ReportReasonKey = (typeof REPORT_REASON_KEYS)[number];

function reportReasonApiValue(key: ReportReasonKey): string {
  return i18n.t(`moderation.report.reasons.${key}`, { lng: "pl" });
}

function reportReasonLabel(key: ReportReasonKey, t: (key: string) => string): string {
  return t(`moderation.report.reasons.${key}`);
}

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
function NavIconGeneral() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function NavIconMembers() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function NavIconModeration() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
    </svg>
  );
}

type SettingsTab = "general" | "members" | "moderation";

interface ChannelSettingsModalProps {
  channel: Channel;
  currentUserId: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
  onLeaveComplete?: () => void;
}

export function ChannelSettingsModal({
  channel: initialChannel,
  currentUserId,
  onClose,
  onRefresh,
  onEdit,
  onDelete,
  onLeaveComplete,
}: ChannelSettingsModalProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [details, setDetails] = useState<ChannelDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<SettingsTab>("general");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteClosing, setInviteClosing] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [invites, setInvites] = useState<ChannelInvite[]>([]);
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteCopiedId, setInviteCopiedId] = useState<string | null>(null);
  const [inviteLimitEnabled, setInviteLimitEnabled] = useState(false);
  const [inviteLimitValue, setInviteLimitValue] = useState("50");
  const [inviteRevokingId, setInviteRevokingId] = useState<string | null>(null);
  const [channelCropFile, setChannelCropFile] = useState<File | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportClosing, setReportClosing] = useState(false);
  const [reportReason, setReportReason] = useState(reportReasonApiValue("spam"));
  const [reportDetails, setReportDetails] = useState("");
  const [reportSending, setReportSending] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [closing, setClosing] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [memberProfile, setMemberProfile] = useState<Contact | null>(null);
  const [memberProfileKey, setMemberProfileKey] = useState(0);
  const [memberProfileFriendship, setMemberProfileFriendship] = useState<{
    isFriend: boolean;
    isBlockedByMe: boolean;
  } | null>(null);
  const [leaveConfirmClosing, setLeaveConfirmClosing] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [slowmodeBusy, setSlowmodeBusy] = useState(false);
  const [chatLockBusy, setChatLockBusy] = useState(false);
  const [moderationAction, setModerationAction] = useState<{
    type: "ban" | "mute";
    user: Contact;
  } | null>(null);
  const [moderationDuration, setModerationDuration] = useState(3600);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!memberProfile?._id) {
      setMemberProfileFriendship(null);
      return;
    }

    let cancelled = false;
    setMemberProfileFriendship(null);

    void checkFriendship(memberProfile._id)
      .then((res) => {
        if (!cancelled) {
          setMemberProfileFriendship({
            isFriend: res.isFriend,
            isBlockedByMe: Boolean(res.isBlockedByMe),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMemberProfileFriendship({ isFriend: false, isBlockedByMe: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [memberProfile?._id, memberProfileKey]);

  const slowmodeLabel = (seconds: number): string => {
    if (seconds === 0) return t("moderation.duration.disabled");
    if (seconds === 60) return t("moderation.duration.oneMinute");
    if (seconds === 300) return t("moderation.duration.fiveMinutes");
    if (seconds === 900) return t("moderation.duration.fifteenMinutes");
    return t("moderation.duration.seconds", { count: seconds });
  };

  const memberCountLabel = (n: number): string =>
    t("presence.channelMember", { count: n });

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => onClose(), 220);
  };

  const closeInvite = () => {
    if (inviteClosing) return;
    setInviteClosing(true);
    window.setTimeout(() => {
      setInviteOpen(false);
      setInviteClosing(false);
    }, 220);
  };

  const closeReport = () => {
    if (reportClosing) return;
    setReportClosing(true);
    window.setTimeout(() => {
      setReportOpen(false);
      setReportClosing(false);
    }, 220);
  };

  const closeLeaveConfirm = () => {
    if (leaveConfirmClosing || leaveBusy) return;
    setLeaveConfirmClosing(true);
    window.setTimeout(() => {
      setLeaveConfirmOpen(false);
      setLeaveConfirmClosing(false);
    }, 220);
  };

  const openLeaveConfirm = () => {
    if (leaveBusy) return;
    setLeaveConfirmOpen(true);
  };

  const applyBanMuteLists = useCallback(
    (lists?: Partial<ChannelModerationResponse>) => {
      if (!lists?.bannedMembers && !lists?.mutedMembers) return;
      setDetails((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...(lists.bannedMembers != null
            ? { bannedMembers: mapChannelUserList(lists.bannedMembers) }
            : {}),
          ...(lists.mutedMembers != null
            ? { mutedMembers: mapChannelUserList(lists.mutedMembers) }
            : {}),
        };
      });
    },
    [],
  );

  const loadDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getChannelDetails(initialChannel._id);
      const c = res.channel;
      const admin = mapChannelUser(c.admin) ?? c.admin;
      setDetails({
        ...c,
        admin,
        members: mapChannelUserList(c.members),
        bannedMembers: mapChannelUserList(c.bannedMembers ?? []),
        mutedMembers: mapChannelUserList(c.mutedMembers ?? []),
      });
    } catch {
      setDetails((prev) =>
        prev ?? {
          ...initialChannel,
          memberCount: initialChannel.members.length + 1,
          isAdmin: String(initialChannel.admin._id) === currentUserId,
          isMuted: false,
          bannedMembers: [],
          mutedMembers: [],
        },
      );
    } finally {
      setLoading(false);
    }
  }, [initialChannel, currentUserId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    if (tab === "moderation") {
      void loadDetails();
    }
  }, [tab, loadDetails]);

  const ch: ChannelDetails = details ?? {
    ...initialChannel,
    memberCount: initialChannel.members.length + 1,
    isAdmin: String(initialChannel.admin._id) === currentUserId,
    isMuted: false,
    bannedMembers: [],
    mutedMembers: [],
  };

  const isAdmin = ch.isAdmin;
  const slowmodeSeconds = ch.rateLimitPerUser ?? 0;
  const chatLocked = ch.chatLocked ?? false;

  async function handleSlowmodeChange(next: number) {
    if (!isAdmin || slowmodeBusy) return;
    setSlowmodeBusy(true);
    try {
      const res = await updateChannelSlowmode(initialChannel._id, next);
      setDetails((d) => (d ? { ...d, rateLimitPerUser: res.rateLimitPerUser } : d));
      onRefresh?.();
    } finally {
      setSlowmodeBusy(false);
    }
  }

  async function handleChatLockToggle() {
    if (!isAdmin || chatLockBusy) return;
    setChatLockBusy(true);
    try {
      const res = await updateChannelChatLock(initialChannel._id, !chatLocked);
      setDetails((d) => (d ? { ...d, chatLocked: res.chatLocked } : d));
      onRefresh?.();
    } finally {
      setChatLockBusy(false);
    }
  }

  async function submitModerationAction() {
    if (!moderationAction) return;
    const { type, user } = moderationAction;
    const duration = moderationDuration;
    const actionKey = `${type}-${user._id}`;
    setActionBusy(actionKey);
    try {
      const result =
        type === "ban"
          ? await banChannelMember(initialChannel._id, user._id, duration)
          : await muteChannelMember(initialChannel._id, user._id, duration);
      applyBanMuteLists(result);
      await loadDetails();
      setModerationAction(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("modals.channelSettings.toast.operationFailed"));
    } finally {
      setActionBusy(null);
    }
  }

  const toolbarBtn = (danger = false, disabled = false, active = false): React.CSSProperties => ({
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 6, padding: "14px 8px",
    background: disabled ? "transparent" : active ? "var(--accent-dim)" : danger ? C.dangerDim : C.accentDim,
    border: `1px solid ${disabled ? C.borderLight : active ? C.accent : danger ? C.dangerBorder : C.accentBorder}`,
    borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "#3a3a44" : danger ? C.danger : active ? "#c4b5fd" : C.accent,
    fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.04em",
  });

  const toolbarBtnGrey = (disabled = false, active = false): React.CSSProperties => ({
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    gap: 6, padding: "14px 8px",
    background: disabled ? "transparent" : active ? "var(--accent-dim)" : "transparent",
    border: `1px solid ${disabled ? C.borderLight : active ? C.border : C.borderLight}`,
    borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
    color: disabled ? "#3a3a44" : C.textMuted,
    fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.04em",
  });


  const handleInvite = async () => {
    if (!isAdmin) return;
    setInviteOpen(true);
    setInviteLoading(true);
    setInviteCopiedId(null);
    try {
      const res = await listChannelInvites(initialChannel._id);
      setInvites(res.invites.filter((i) => !i.revoked));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("modals.channelSettings.toast.inviteCreateFailed"));
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!isAdmin || inviteCreating) return;
    let maxUses: number | null = null;
    if (inviteLimitEnabled) {
      const parsed = Math.floor(Number(inviteLimitValue));
      if (!Number.isFinite(parsed) || parsed < 1) {
        toast.error(t("modals.channelSettings.inviteModal.invalidLimit"));
        return;
      }
      maxUses = parsed;
    }
    setInviteCreating(true);
    try {
      const invite = await createChannelInvite(initialChannel._id, maxUses);
      setInvites((prev) => [invite, ...prev]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("modals.channelSettings.toast.inviteCreateFailed"));
    } finally {
      setInviteCreating(false);
    }
  };

  const copyInvite = async (url: string, inviteId: string) => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopiedId(inviteId);
      window.setTimeout(() => setInviteCopiedId((cur) => (cur === inviteId ? null : cur)), 2000);
      toast.success(t("modals.channelSettings.toast.inviteCopied"));
    } catch {
      toast.warning(t("modals.channelSettings.toast.inviteCopyManual", { url }));
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    if (!isAdmin || inviteRevokingId) return;
    setInviteRevokingId(inviteId);
    try {
      await deleteChannelInvite(initialChannel._id, inviteId);
      setInvites((prev) => prev.filter((i) => i.inviteId !== inviteId));
      toast.success(t("modals.channelSettings.toast.inviteRevoked"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("modals.channelSettings.toast.inviteRevokeFailed"));
    } finally {
      setInviteRevokingId(null);
    }
  };

  const handleReport = async () => {
    setReportSending(true);
    try {
      await reportChannel(initialChannel._id, {
        reason: reportReason,
        details: reportDetails.trim() || undefined,
      });
      setReportSuccess(true);
      toast.success(t("modals.channelSettings.toast.reportSent"));
      setTimeout(() => {
        closeReport();
        setReportSuccess(false);
        setReportDetails("");
      }, 1800);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("moderation.report.sendFailed"));
    } finally {
      setReportSending(false);
    }
  };

  const handleLeave = async () => {
    if (isAdmin) {
      requestClose();
      return;
    }
    setLeaveBusy(true);
    try {
      await leaveChannel(initialChannel._id);
      await onRefresh();
      onLeaveComplete?.();
      setLeaveConfirmOpen(false);
      setLeaveConfirmClosing(false);
      requestClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("modals.channelSettings.toast.leaveFailed"));
    } finally {
      setLeaveBusy(false);
    }
  };

  const handleFooterAction = () => {
    if (isAdmin) {
      requestClose();
      return;
    }
    openLeaveConfirm();
  };

  const handleAvatarUpload = async (file: File) => {
    setAvatarLoading(true);
    try {
      const res = await uploadChannelAvatar(initialChannel._id, file);
      bumpPublicMediaCache(res.image);
      bumpPublicMediaCacheForChannel(initialChannel._id);
      setDetails((d) => d ? { ...d, image: res.image } : { ...initialChannel, image: res.image, memberCount: initialChannel.members.length + 1, isAdmin: String(initialChannel.admin._id) === currentUserId, isMuted: false });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("modals.channelSettings.toast.avatarUploadFailed"));
    } finally {
      setAvatarLoading(false);
    }
  };

    const handleRemoveAvatar = async () => {
      if (!isAdmin) return;
      if (!((details?.image ?? initialChannel.image))) return;
      setAvatarLoading(true);
      try {
        await removeChannelAvatar(initialChannel._id);
        bumpPublicMediaCacheForChannel(initialChannel._id);
        setDetails((d) => d ? { ...d, image: "" } : { ...initialChannel, image: "", memberCount: initialChannel.members.length + 1, isAdmin: String(initialChannel.admin._id) === currentUserId, isMuted: false });
        await loadDetails();
        await onRefresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("modals.channelSettings.toast.avatarRemoveFailed"));
      } finally {
        setAvatarLoading(false);
      }
    };

  const onAvatarInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      toast.error(t("upload.avatarTooLarge", { limit: MAX_AVATAR_SIZE_LABEL }));
      e.target.value = "";
      return;
    }
    setChannelCropFile(file);
    e.target.value = "";
  };

  const handleChannelCropConfirm = async (file: File) => {
    await handleAvatarUpload(file);
    setChannelCropFile(null);
  };

  const triggerAvatarUpload = () => {
    avatarFileRef.current?.click();
  };

  const runModAction = async (
    key: string,
    fn: () => Promise<ChannelModerationResponse | { message: string } | void>,
  ) => {
    setActionBusy(key);
    try {
      const result = await fn();
      if (result && ("bannedMembers" in result || "mutedMembers" in result)) {
        applyBanMuteLists(result as ChannelModerationResponse);
      }
      await loadDetails();
      await onRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("modals.channelSettings.toast.operationFailed"));
    } finally {
      setActionBusy(null);
    }
  };

  const adminContact = mapChannelUser(ch.admin) ?? ch.admin;
  const memberContacts = mapChannelUserList(ch.members);
  const bannedContacts = mapChannelUserList(ch.bannedMembers);
  const mutedContacts = mapChannelUserList(ch.mutedMembers);

  const allMembers: Contact[] = [
    adminContact,
    ...memberContacts.filter((m) => String(m._id) !== String(adminContact._id)),
  ];

  const buildMemberMenuItems = (
    contact: Contact,
    options: {
      showKick?: boolean;
      showBan?: boolean;
      showMute?: boolean;
      showUnban?: boolean;
      showUnmute?: boolean;
    },
  ): ActionMenuItem[] => {
    const id = contact._id;
    const busy = Boolean(actionBusy);
    const items: ActionMenuItem[] = [];

    if (options.showKick) {
      items.push({
        key: "kick",
        label: t("moderation.actions.kick"),
        icon: <UserMinus size={14} />,
        disabled: busy,
        onClick: () => runModAction(`kick-${id}`, () => kickChannelMember(initialChannel._id, id)),
      });
    }
    if (options.showBan) {
      items.push({
        key: "ban",
        label: t("moderation.actions.ban"),
        icon: <Ban size={14} />,
        danger: true,
        disabled: busy,
        onClick: () => {
          setModerationDuration(3600);
          setModerationAction({ type: "ban", user: contact });
        },
      });
    }
    if (options.showMute) {
      items.push({
        key: "mute",
        label: t("moderation.actions.mute"),
        icon: <VolumeX size={14} />,
        disabled: busy,
        onClick: () => {
          setModerationDuration(1800);
          setModerationAction({ type: "mute", user: contact });
        },
      });
    }
    if (options.showUnban) {
      items.push({
        key: "unban",
        label: t("moderation.actions.unban"),
        icon: <Ban size={14} />,
        disabled: busy,
        onClick: () => runModAction(`unban-${id}`, () => unbanChannelMember(initialChannel._id, id)),
      });
    }
    if (options.showUnmute) {
      items.push({
        key: "unmute",
        label: t("moderation.actions.unmute"),
        icon: <Volume2 size={14} />,
        disabled: busy,
        onClick: () => runModAction(`unmute-${id}`, () => unmuteChannelMember(initialChannel._id, id)),
      });
    }

    return items;
  };

  const renderMemberRow = (
    member: Contact,
    options: {
      showKick?: boolean;
      showBan?: boolean;
      showMute?: boolean;
      showUnban?: boolean;
      showUnmute?: boolean;
      clickable?: boolean;
    },
  ) => {
    const contact = mapChannelUser(member) ?? member;
    const id = contact._id;
    const isOwner = String(id) === String(adminContact._id);
    const isSelf = String(id) === String(currentUserId);
    const openProfile = options.clickable && !isSelf;
    return (
      <div
        key={id}
        className="cs-member-row"
        style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "10px 12px", borderRadius: 8,
          background: C.bgDeep, marginBottom: 6,
        }}
      >
        <button
          type="button"
          disabled={!openProfile}
          onClick={() => {
            if (!openProfile) return;
            setMemberProfile(contact);
            setMemberProfileKey((k) => k + 1);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 12,
            border: "none",
            background: "transparent",
            padding: 0,
            margin: 0,
            textAlign: "left",
            cursor: openProfile ? "pointer" : "default",
            font: "inherit",
            color: "inherit",
          }}
        >
          <Avatar
            displayName={contact.displayName}
            username={contact.username}
            image={contact.image}
            color={contact.color}
            size={36}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "0.85rem", color: C.text, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
              {userLabel(contact)}
              {isOwner ? (
                <span style={{ marginLeft: 6, fontSize: "0.7rem", color: C.accent }}>{t("channel.members.ownerBadge")}</span>
              ) : null}
            </div>
            {contact.username ? (
              <div style={{ fontSize: "0.75rem", color: C.textDim }}>@{contact.username}</div>
            ) : null}
            {(options.showBan || options.showMute || options.showUnban || options.showUnmute) &&
            (contact.moderationExpiresAt || contact.moderationPermanent) ? (
              <div style={{ fontSize: "0.72rem", color: C.textMuted, marginTop: 2, fontFamily: "var(--font-sans)" }}>
                {formatModerationExpiry(
                  contact.moderationExpiresAt,
                  contact.moderationPermanent,
                )}
              </div>
            ) : null}
          </div>
        </button>
        {isAdmin && !isOwner && (
          <ActionMenu
            label={t("chat.bubble.options")}
            items={buildMemberMenuItems(contact, options)}
          />
        )}
      </div>
    );
  };

  const navItems: Array<{
    key: SettingsTab;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }> = [
    { key: "general", label: t("modals.channelSettings.tabs.general"), icon: <NavIconGeneral /> },
    { key: "members", label: t("modals.channelSettings.tabs.members"), icon: <NavIconMembers /> },
    { key: "moderation", label: t("modals.channelSettings.tabs.moderation"), icon: <NavIconModeration />, adminOnly: true },
  ];

  const renderChannelHeader = () => (
    <div className="cs-header" style={{
      background: "linear-gradient(135deg, var(--bg-panel) 0%, var(--bg-elevated) 100%)",
      borderBottom: `1px solid ${C.border}`,
      padding: "22px 18px 18px",
      display: "flex", alignItems: "flex-start", gap: 16,
    }}>
      <div
        role="button"
        tabIndex={0}
        onClick={triggerAvatarUpload}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); triggerAvatarUpload(); } }}
        style={{
          position: "relative",
          border: "none",
          background: "transparent",
          padding: 0,
          margin: 0,
          cursor: avatarLoading ? "wait" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        title={t("modals.channelSettings.avatarClick")}
      >
        <Avatar
          displayName={initialChannel.name}
          image={details?.image ?? initialChannel.image}
          placeholder="#"
          size={52}
        />
        {avatarLoading && (
          <div style={{
            position: "absolute",
            width: 52,
            height: 52,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: "0.7rem",
          }}>
            {t("common.loading")}
          </div>
        )}
        {isAdmin && (details?.image ?? initialChannel.image) && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void handleRemoveAvatar(); }}
            title={t("modals.channelSettings.removeAvatar")}
            style={{
              position: "absolute",
              right: -8,
              top: -8,
              width: 28,
              height: 28,
              borderRadius: 14,
              border: `1px solid ${C.border}`,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: C.text,
              cursor: avatarLoading ? "wait" : "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
            </svg>
          </button>
        )}
      </div>
      <input
        ref={avatarFileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={onAvatarInputChange}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: "1.1rem", fontWeight: 700, color: C.text, fontFamily: "var(--font-sans)" }}>
          {ch.name}
        </h2>
        <p style={{ margin: 0, fontSize: "0.82rem", color: C.textMuted, fontFamily: "var(--font-sans)" }}>
          {loading ? t("common.loading") : memberCountLabel(ch.memberCount)}
        </p>
        {ch.description ? (
          <p style={{ margin: "6px 0 0", fontSize: "0.8rem", color: C.textDim, lineHeight: 1.5, fontFamily: "var(--font-sans)" }}>
            {ch.description}
          </p>
        ) : null}
      </div>
      <HoverBtn type="button" style={closeBtnStyle} hoverStyle={{ background: C.bgHover, color: C.text }} aria-label={t("common.close")} onClick={requestClose}>×</HoverBtn>
    </div>
  );

  return (
    <>
    <div
      className={`klovy-backdrop klovy-backdrop--center${closing ? " closing" : ""}`}
      onClick={(e) => { if (e.target === e.currentTarget) requestClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div className="klovy-shell cs-modal" style={modalCard} onClick={(e) => e.stopPropagation()}>
        <aside className="cs-nav">
          {navItems.map((item) => {
            if (item.adminOnly && !isAdmin) return null;
            return (
              <button
                key={item.key}
                type="button"
                className={`cs-nav-item${tab === item.key ? " active" : ""}`}
                onClick={() => setTab(item.key)}
              >
                {item.icon}
                {item.label}
              </button>
            );
          })}
        </aside>

        <div className="cs-content">
          {renderChannelHeader()}

          <div className="cs-content-scroll">
            {tab === "general" && (
              <>
                <div className="cs-general-intro">
                  <h3 className="cs-section-title">{t("modals.channelSettings.title")}</h3>
                  <p className="cs-section-subtitle">
                    {t("modals.channelSettings.generalSubtitle")}
                  </p>
                </div>

                <div className="cs-toolbar-row">
                  {isAdmin && (
                    <HoverBtn type="button" style={toolbarBtnGrey()} hoverStyle={{ background: "var(--accent-dim)" }} onClick={onEdit}>
                      {t("modals.channelSettings.edit")}
                    </HoverBtn>
                  )}
                  <HoverBtn
                    type="button"
                    style={toolbarBtnGrey(false, !isAdmin)}
                    hoverStyle={{ background: "var(--accent-dim)" }}
                    disabled={!isAdmin}
                    onClick={() => void handleInvite()}
                  >
                    {t("modals.channelSettings.invite")}
                  </HoverBtn>
                  {isAdmin && (
                    <HoverBtn type="button" style={toolbarBtn(true)} hoverStyle={{ background: "rgba(239,68,68,0.15)" }} onClick={onDelete}>
                      {t("modals.channelSettings.delete")}
                    </HoverBtn>
                  )}
                </div>

                <button
                  type="button"
                  className="cs-list-item"
                  onClick={() => { setReportOpen(true); setReportSuccess(false); }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" />
                  </svg>
                  {t("moderation.report.action")}
                  <span className="cs-list-chevron">›</span>
                </button>
              </>
            )}

            {tab === "members" && (
              <>
                <h3 className="cs-section-title">{t("modals.channelSettings.membersTitle")}</h3>
                <p className="cs-section-subtitle">
                  {t("modals.channelSettings.membersActionsHint")}
                </p>
                {allMembers.map((m) => renderMemberRow(m, { showKick: true, showBan: true, showMute: true, clickable: true }))}
                <p style={{ margin: "16px 0 8px", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textDim, fontFamily: "var(--font-sans)" }}>
                  {t("modals.channelSettings.membersAdminTitle")}
                </p>
                <p style={{ margin: "0 0 10px", fontSize: "0.8rem", color: C.textMuted, fontFamily: "var(--font-sans)" }}>
                  {t("modals.channelSettings.adminNote")}
                </p>
                {renderMemberRow(ch.admin, { clickable: true })}
              </>
            )}

            {tab === "moderation" && isAdmin && (
              <>
                <h3 className="cs-section-title">{t("modals.channelSettings.moderationTitle")}</h3>
                <p className="cs-section-subtitle">
                  {t("modals.channelSettings.moderationSubtitle")}
                </p>

                <div className="cs-card">
                  <div className="cs-card-head">
                    <div>
                      <p className="cs-card-label">{t("modals.channelSettings.slowmodeTitle")}</p>
                      <p className="cs-card-hint">
                        {t("modals.channelSettings.slowmodeHint")}
                      </p>
                    </div>
                    <span className={`cs-card-status${slowmodeSeconds > 0 ? " is-active" : ""}`}>
                      {slowmodeLabel(slowmodeSeconds)}
                    </span>
                  </div>
                  <select
                    className="cs-select"
                    value={slowmodeSeconds}
                    disabled={slowmodeBusy}
                    onChange={(e) => void handleSlowmodeChange(Number(e.target.value))}
                  >
                    <option value={0}>{t("moderation.duration.disabled")}</option>
                    <option value={5}>{t("moderation.duration.seconds", { count: 5 })}</option>
                    <option value={10}>{t("moderation.duration.seconds", { count: 10 })}</option>
                    <option value={30}>{t("moderation.duration.seconds", { count: 30 })}</option>
                    <option value={60}>{t("moderation.duration.oneMinute")}</option>
                    <option value={300}>{t("moderation.duration.fiveMinutes")}</option>
                    <option value={900}>{t("moderation.duration.fifteenMinutes")}</option>
                  </select>
                </div>

                <div className="cs-card">
                  <div className="cs-card-head">
                    <div>
                      <p className="cs-card-label">{t("modals.channelSettings.chatLockTitle")}</p>
                      <p className="cs-card-hint">
                        {t("modals.channelSettings.chatLockHint")}
                      </p>
                    </div>
                    <span className={`cs-card-status${chatLocked ? " is-locked" : ""}`}>
                      {chatLocked ? t("modals.channelSettings.chatLockStatusLocked") : t("modals.channelSettings.chatLockStatusActive")}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={`cs-lock-btn${chatLocked ? " is-success" : " is-danger"}`}
                    disabled={chatLockBusy}
                    onClick={() => void handleChatLockToggle()}
                  >
                    {chatLockBusy
                      ? t("common.saving")
                      : chatLocked
                        ? t("moderation.slowmode.unlock")
                        : t("moderation.slowmode.lock")}
                  </button>
                </div>

                <p style={{ margin: "18px 0 8px", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textDim, fontFamily: "var(--font-sans)" }}>
                  {t("moderation.lists.banned")}
                </p>
                {loading && bannedContacts.length === 0 ? (
                  <p style={{ color: C.textDim, fontSize: "0.85rem", fontFamily: "var(--font-sans)" }}>{t("common.loadingList")}</p>
                ) : bannedContacts.length === 0 ? (
                  <p style={{ color: C.textDim, fontSize: "0.85rem", fontFamily: "var(--font-sans)" }}>{t("moderation.lists.noBanned")}</p>
                ) : (
                  bannedContacts.map((m) => renderMemberRow(m, { showUnban: true }))
                )}

                <p style={{ margin: "18px 0 8px", fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textDim, fontFamily: "var(--font-sans)" }}>
                  {t("moderation.lists.muted")}
                </p>
                {loading && mutedContacts.length === 0 ? (
                  <p style={{ color: C.textDim, fontSize: "0.85rem", fontFamily: "var(--font-sans)" }}>{t("common.loadingList")}</p>
                ) : mutedContacts.length === 0 ? (
                  <p style={{ color: C.textDim, fontSize: "0.85rem", fontFamily: "var(--font-sans)" }}>{t("moderation.lists.noMuted")}</p>
                ) : (
                  mutedContacts.map((m) => renderMemberRow(m, { showUnmute: true }))
                )}
              </>
            )}

          </div>

          <div className="cs-footer">
            <HoverBtn
              type="button"
              style={{
                padding: "10px 18px",
                background: "transparent",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                fontSize: "0.75rem",
                fontWeight: 700,
                letterSpacing: "0.1em",
                color: C.textMuted,
                cursor: leaveBusy ? "wait" : "pointer",
                fontFamily: "var(--font-sans)",
              }}
              hoverStyle={{ background: C.bgHover, color: C.text }}
              disabled={leaveBusy}
              onClick={handleFooterAction}
            >
              {isAdmin ? t("modals.channelSettings.footerClose") : leaveBusy ? t("common.leaving") : t("modals.channelSettings.footerLeave")}
            </HoverBtn>
          </div>
        </div>
      </div>
    </div>

      {moderationAction ? (
        <div
          className="klovy-backdrop klovy-backdrop--stacked"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModerationAction(null);
          }}
        >
          <div
            className="klovy-shell"
            style={{ ...modalCard, width: 420, padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px", color: C.text, fontFamily: "var(--font-sans)" }}>
              {moderationAction.type === "ban" ? t("moderation.actions.banUser") : t("moderation.actions.muteUser")}
            </h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: C.textMuted, fontFamily: "var(--font-sans)" }}>
              {userLabel(moderationAction.user)} · {t("moderation.actions.chooseDuration")}
            </p>
            <label
              htmlFor="moderation-duration"
              style={{ display: "block", marginBottom: 8, fontSize: "0.82rem", color: C.textMuted, fontFamily: "var(--font-sans)" }}
            >
              {t("moderation.actions.durationLabel")}
            </label>
            <select
              id="moderation-duration"
              className="cs-select"
              value={moderationDuration}
              onChange={(e) => setModerationDuration(Number(e.target.value))}
            >
              {CHANNEL_MOD_DURATION_OPTIONS.map((option) => (
                <option key={option.seconds} value={option.seconds}>
                  {option.label}
                </option>
              ))}
            </select>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <HoverBtn
                type="button"
                style={btnSecondary}
                onClick={() => setModerationAction(null)}
              >
                {t("common.cancel")}
              </HoverBtn>
              <HoverBtn
                type="button"
                style={btnPrimary}
                disabled={!!actionBusy}
                onClick={() => void submitModerationAction()}
              >
                {actionBusy
                  ? t("common.saving")
                  : moderationAction.type === "ban"
                    ? t("moderation.actions.ban")
                    : t("moderation.actions.mute")}
              </HoverBtn>
            </div>
          </div>
        </div>
      ) : null}

      {(inviteOpen || inviteClosing) && (
        <div
          className={`klovy-backdrop klovy-backdrop--stacked${inviteClosing ? " closing" : ""}`}
          onClick={(e) => { if (e.target === e.currentTarget) closeInvite(); }}
        >
          <div className="klovy-shell" style={{ ...modalCard, width: 460, maxWidth: "94vw", padding: 24, maxHeight: "88vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px", color: C.text }}>{t("modals.channelSettings.inviteModal.title")}</h3>
            <p style={{ margin: "0 0 16px", fontSize: "0.85rem", color: C.textMuted }}>
              {t("modals.channelSettings.inviteModal.hint")}
            </p>

            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: C.text, fontSize: "0.85rem", fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={inviteLimitEnabled}
                  onChange={(e) => setInviteLimitEnabled(e.target.checked)}
                />
                {t("modals.channelSettings.inviteModal.limitToggle")}
              </label>
              {inviteLimitEnabled ? (
                <div style={{ marginTop: 10 }}>
                  <input
                    type="number"
                    min={1}
                    value={inviteLimitValue}
                    onChange={(e) => setInviteLimitValue(e.target.value)}
                    placeholder={t("modals.channelSettings.inviteModal.limitPlaceholder")}
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: C.bgDeep, border: `1px solid ${C.border}`,
                      borderRadius: 8, padding: "8px 12px", color: C.text, fontSize: "0.85rem",
                    }}
                  />
                  <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: C.textMuted }}>
                    {t("modals.channelSettings.inviteModal.limitHint")}
                  </p>
                </div>
              ) : (
                <p style={{ margin: "6px 0 0", fontSize: "0.72rem", color: C.textMuted }}>
                  {t("modals.channelSettings.inviteModal.unlimitedHint")}
                </p>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                <HoverBtn type="button" style={btnPrimary} disabled={inviteCreating} onClick={() => void handleCreateInvite()}>
                  {inviteCreating ? t("modals.channelSettings.inviteModal.generating") : t("modals.channelSettings.inviteModal.create")}
                </HoverBtn>
              </div>
            </div>

            <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
              {inviteLoading ? (
                <p style={{ color: C.textMuted, fontSize: "0.85rem" }}>{t("modals.channelSettings.inviteModal.generating")}</p>
              ) : invites.length === 0 ? (
                <p style={{ color: C.textMuted, fontSize: "0.85rem" }}>{t("modals.channelSettings.inviteModal.empty")}</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {invites.map((inv) => (
                    <div key={inv.inviteId} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                      <input
                        readOnly
                        value={inv.url}
                        onFocus={(e) => e.currentTarget.select()}
                        style={{
                          width: "100%", boxSizing: "border-box",
                          background: C.bgDeep, border: `1px solid ${C.border}`,
                          borderRadius: 8, padding: "8px 10px", color: C.text, fontSize: "0.78rem",
                        }}
                      />
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: "0.75rem", color: C.textMuted }}>
                          {inv.maxUses == null
                            ? t("modals.channelSettings.inviteModal.usesUnlimited", { count: inv.useCount })
                            : t("modals.channelSettings.inviteModal.usesLimited", { count: inv.useCount, max: inv.maxUses })}
                        </span>
                        <div style={{ display: "flex", gap: 8 }}>
                          <HoverBtn type="button" style={btnSecondary} onClick={() => void copyInvite(inv.url, inv.inviteId)}>
                            {inviteCopiedId === inv.inviteId ? t("common.copied") : t("modals.channelSettings.inviteModal.copyLink")}
                          </HoverBtn>
                          <HoverBtn
                            type="button"
                            style={{ ...btnSecondary, color: "#f87171", borderColor: "rgba(248,113,113,0.4)" }}
                            disabled={inviteRevokingId === inv.inviteId}
                            onClick={() => void handleRevokeInvite(inv.inviteId)}
                          >
                            {t("modals.channelSettings.inviteModal.revoke")}
                          </HoverBtn>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
              <HoverBtn type="button" style={btnSecondary} onClick={closeInvite}>{t("common.close")}</HoverBtn>
            </div>
          </div>
        </div>
      )}

      {channelCropFile ? (
        <ImageCropModal
          file={channelCropFile}
          aspect={1}
          outputWidth={512}
          outputHeight={512}
          round
          title={t("imageCrop.channelAvatarTitle")}
          maxSizeLabel={MAX_AVATAR_SIZE_LABEL}
          busy={avatarLoading}
          onCancel={() => setChannelCropFile(null)}
          onConfirm={handleChannelCropConfirm}
        />
      ) : null}

      {(leaveConfirmOpen || leaveConfirmClosing) && !isAdmin && (
        <div
          className={`klovy-backdrop klovy-backdrop--stacked${leaveConfirmClosing ? " closing" : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLeaveConfirm();
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="channel-leave-confirm-title"
        >
          <div
            className="klovy-shell"
            style={confirmModalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={modalHeader}>
              <div>
                <p id="channel-leave-confirm-title" style={modalTitle}>
                  {t("modals.channelSettings.leaveConfirm.title")}
                </p>
                <p style={modalSubtitle}>
                  {t("modals.channelSettings.leaveConfirm.subtitle")}
                </p>
              </div>
              <HoverBtn
                type="button"
                style={closeBtnStyle}
                hoverStyle={{ background: C.bgHover, color: C.text }}
                aria-label={t("common.close")}
                disabled={leaveBusy}
                onClick={closeLeaveConfirm}
              >
                ×
              </HoverBtn>
            </div>
            <div style={modalBody}>
              <div
                style={{
                  background: C.dangerDim,
                  border: `1px solid ${C.dangerBorder}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={C.danger}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0, marginTop: 1 }}
                  aria-hidden="true"
                >
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.84rem",
                    color: "#fca5a5",
                    lineHeight: 1.6,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {t("modals.channelSettings.leaveConfirm.confirmWithName", {
                    name: details?.name ?? initialChannel.name,
                  })}{" "}
                  {t("modals.channelSettings.leaveConfirm.rejoinHint")}
                </p>
              </div>
            </div>
            <div style={modalFooter}>
              <HoverBtn
                type="button"
                style={btnSecondary}
                hoverStyle={{ background: C.bgHover, color: C.text }}
                disabled={leaveBusy}
                onClick={closeLeaveConfirm}
              >
                {t("common.cancel")}
              </HoverBtn>
              <HoverBtn
                type="button"
                style={btnDanger}
                hoverStyle={{ background: "#dc2626" }}
                disabled={leaveBusy}
                onClick={() => void handleLeave()}
              >
                {leaveBusy ? t("common.leaving") : t("modals.channelSettings.leaveConfirm.submit")}
              </HoverBtn>
            </div>
          </div>
        </div>
      )}

      {(reportOpen || reportClosing) && (
        <div
          className={`klovy-backdrop klovy-backdrop--stacked${reportClosing ? " closing" : ""}`}
          onClick={(e) => { if (e.target === e.currentTarget) closeReport(); }}
        >
          <div className="klovy-shell" style={{ ...modalCard, width: 420, padding: 24 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 8px", color: C.text }}>{t("moderation.report.title")}</h3>
            {reportSuccess ? (
              <p style={{ color: "#4ade80", fontSize: "0.9rem" }}>
                {t("modals.channelSettings.reportSentAdmin")}
              </p>
            ) : (
              <>
                <label style={fieldLabel}>{t("moderation.report.reason")}</label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  style={{
                    width: "100%", marginBottom: 14,
                    background: C.bgDeep, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "10px 12px", color: C.text,
                    fontFamily: "inherit", fontSize: "0.9rem",
                  }}
                >
                  {REPORT_REASON_KEYS.map((key) => (
                    <option key={key} value={reportReasonApiValue(key)}>
                      {reportReasonLabel(key, t)}
                    </option>
                  ))}
                </select>
                <label style={fieldLabel}>{t("moderation.report.details")}</label>
                <textarea
                  rows={4}
                  maxLength={1000}
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value.slice(0, 1000))}
                  placeholder={t("modals.channelSettings.reportDetailsPlaceholder")}
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: C.bgDeep, border: `1px solid ${C.border}`,
                    borderRadius: 8, padding: "10px 12px", color: C.text,
                    resize: "vertical", fontFamily: "inherit",
                  }}
                />
                <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
                  <HoverBtn type="button" style={btnSecondary} onClick={closeReport}>{t("common.cancel")}</HoverBtn>
                  <HoverBtn
                    type="button"
                    style={btnDanger}
                    disabled={reportSending}
                    onClick={() => void handleReport()}
                  >
                    {reportSending ? t("common.sending") : t("moderation.report.send")}
                  </HoverBtn>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <OtherUserProfileModal
        isOpen={Boolean(memberProfile)}
        openKey={memberProfileKey}
        onClose={() => {
          setMemberProfile(null);
          setMemberProfileFriendship(null);
        }}
        user={memberProfile}
        isFriend={memberProfileFriendship?.isFriend ?? false}
        friendshipLoading={Boolean(memberProfile) && memberProfileFriendship === null}
        isBlockedByMe={memberProfileFriendship?.isBlockedByMe}
      />
    </>
  );
}

const closeBtnStyle: React.CSSProperties = {
  width: 32, height: 32,
  display: "flex", alignItems: "center", justifyContent: "center",
  background: "transparent", border: "none", cursor: "pointer",
  color: C.textMuted, fontSize: "1.3rem", borderRadius: 8,
};

const fieldLabel: React.CSSProperties = {
  display: "block", marginBottom: 8,
  fontSize: "0.7rem", fontWeight: 700,
  letterSpacing: "0.1em", textTransform: "uppercase",
  color: C.textMuted,
};

const btnPrimary: React.CSSProperties = {
  padding: "10px 22px",
  background: C.accent, border: "none", borderRadius: 8,
  fontSize: "0.85rem", fontWeight: 700, color: "#fff", cursor: "pointer",
};

const btnSecondary: React.CSSProperties = {
  padding: "10px 18px",
  background: "transparent", border: `1px solid ${C.border}`,
  borderRadius: 8, fontSize: "0.85rem", fontWeight: 600,
  color: C.textMuted, cursor: "pointer",
};

const btnDanger: React.CSSProperties = {
  padding: "10px 22px",
  background: C.danger, border: "none", borderRadius: 8,
  fontSize: "0.85rem", fontWeight: 700, color: "#fff", cursor: "pointer",
};
