import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Award,
  CheckCircle,
  Key,
  List,
  Megaphone,
  Pencil,
  RotateCcw,
  Shield,
  ShieldOff,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UserCheck,
  UserX,
  XCircle,
} from "lucide-react";
import { useWebSocket } from "../context/WebSocketContext";
import { useLocale } from "../context/LocaleContext";
import { useProfileSync } from "../hooks/useProfileSync";
import {
  banAdminUser,
  deleteAdminChannel,
  deleteAdminChannelReport,
  deleteAdminUser,
  listAdminChannels,
  listAdminChannelReports,
  listAdminUsers,
  getAdminSession,
  setAdminUserPassword,
  setAdminUserWhitelist,
  listAdminAnnouncements,
  createAdminAnnouncement,
  updateAdminAnnouncement,
  deleteAdminAnnouncement,
  restoreAdminUser,
  unbanAdminUser,
  updateAdminChannelReport,
  listBadges,
  createBadge,
  updateBadge,
  deleteBadge,
  assignBadge,
  getUserBadges,
  removeBadge,
  warnAdminUser,
  listAdminUserWarnings,
  deleteAdminUserWarning,
  type AdminChannelReportRow,
  type AdminChannelRow,
  type AdminUserRow,
  type AdminBadgeRow,
  type AdminAnnouncementRow,
  type AdminWarningRow,
  type UserBadgeAssignment,
  type WarningSeverity,
} from "../api/admin";
import { ApiError } from "../api/client";
import { isValidBadgeColor, isValidBadgeIcon } from "../utils/user/badgeValidation";
import { AdminActionMenu, type AdminMenuItem } from "../components/admin/AdminActionMenu";
import { AdminBrand } from "../components/admin/AdminBrand";
import { Avatar } from "../components/common/Avatar";
import BadgeComponent from "../components/common/Badge";
import "../components/common/badge.css";
import "../styles/admin/admin.css";

type AdminUserAvatarSource = {
  username: string;
  displayName?: string | null;
  image?: string | null;
  color?: number | null;
};

function AdminUserAvatar({
  user,
  size = 42,
}: {
  user: AdminUserAvatarSource;
  size?: number;
}) {
  return (
    <div className="adm-card-avatar adm-card-avatar--user">
      <Avatar
        key={`${user.username}-${user.color ?? 0}-${user.image ?? ""}`}
        username={user.username}
        displayName={user.displayName}
        image={user.image}
        color={user.color}
        size={size}
      />
    </div>
  );
}

function AdminChannelAvatar({ name }: { name: string }) {
  return (
    <div className="adm-card-avatar adm-card-avatar--channel">
      <Avatar username={name} placeholder="#" size={42} />
    </div>
  );
}

function AdminListWrap({
  fetching,
  children,
}: {
  fetching: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`adm-list-wrap${fetching ? " adm-list-wrap--fetching" : ""}`}>
      {fetching ? <div className="adm-list-fetch-bar" aria-hidden="true" /> : null}
      {children}
    </div>
  );
}

function formatAssignedDate(
  value: string | undefined,
  dateLocale: string,
  emDash: string,
): string {
  if (!value) return emDash;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? emDash
    : date.toLocaleString(dateLocale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

type Tab = "users" | "channels" | "reports" | "badges" | "announcements";

function UserStatusPill({ user }: { user: AdminUserRow }) {
  const { t } = useTranslation();

  if (user.isBanned || user.isBlocked) {
    return (
      <span className="adm-status-pill adm-status-pill--banned">
        <span className="dot" />{t("admin.status.banned")}
      </span>
    );
  }
  if (user.deletionScheduledAt) {
    return (
      <span className="adm-status-pill adm-status-pill--pending">
        <span className="dot" />{t("admin.status.pendingDeletion")}
      </span>
    );
  }
  if (user.isDisabled) {
    return (
      <span className="adm-status-pill adm-status-pill--blocked">
        <span className="dot" />{t("admin.status.disabled")}
      </span>
    );
  }
  if (user.warningCount > 0) {
    return (
      <span className="adm-status-pill adm-status-pill--warned">
        <span className="dot" />{t("admin.status.warned")}
      </span>
    );
  }
  if (!user.isActive) {
    return (
      <span className="adm-status-pill adm-status-pill--blocked">
        <span className="dot" />{t("admin.status.inactive")}
      </span>
    );
  }
  return (
    <span className="adm-status-pill adm-status-pill--active">
      <span className="dot" />{t("admin.status.active")}
    </span>
  );
}

function ReportStatusPill({ status }: { status: AdminChannelReportRow["status"] }) {
  const { t } = useTranslation();

  if (status === "pending") {
    return <span className="adm-status-pill adm-status-pill--pending">{t("admin.status.pending")}</span>;
  }
  if (status === "reviewed") {
    return <span className="adm-status-pill adm-status-pill--ok">{t("admin.status.reviewed")}</span>;
  }
  return <span className="adm-status-pill adm-status-pill--neutral">{t("admin.status.dismissed")}</span>;
}

function SeverityPill({ severity }: { severity: WarningSeverity }) {
  const { t } = useTranslation();
  const cls =
    severity === "high"
      ? "adm-status-pill--banned"
      : severity === "low"
        ? "adm-status-pill--ok"
        : "adm-status-pill--warned";
  return <span className={`adm-status-pill ${cls}`}>{t(`admin.severity.${severity}`)}</span>;
}

interface AdminPanelProps {
  onClose: () => void;
}

export function AdminPanel({ onClose }: AdminPanelProps) {
  const { t } = useTranslation();
  const { dateLocale } = useLocale();
  const emDash = t("common.emDash");
  const ws = useWebSocket();
  const [tab, setTab] = useState<Tab>("users");
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [channels, setChannels] = useState<AdminChannelRow[]>([]);
  const [reports, setReports] = useState<AdminChannelReportRow[]>([]);
  const [badges, setBadges] = useState<AdminBadgeRow[]>([]);
  const [announcements, setAnnouncements] = useState<AdminAnnouncementRow[]>([]);
  const [pendingReports, setPendingReports] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const tabLoadedRef = useRef<Partial<Record<Tab, boolean>>>({});
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pendingWhitelist, setPendingWhitelist] = useState(0);
  const [whitelistEnabled, setWhitelistEnabled] = useState(false);
  const [whitelistFilter, setWhitelistFilter] = useState<"all" | "pending" | "approved">("all");
  const [userStats, setUserStats] = useState({ total: 0, active: 0, banned: 0 });
  const [listTotal, setListTotal] = useState(0);

  const [banModal, setBanModal] = useState<AdminUserRow | null>(null);
  const [banReason, setBanReason] = useState("");

  const [passwordModal, setPasswordModal] = useState<AdminUserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordFormError, setPasswordFormError] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<{
    type: "user" | "channel" | "badge" | "announcement" | "report";
    id: string;
    label: string;
  } | null>(null);

  const [badgeModal, setBadgeModal] = useState<{
    mode: "create" | "edit";
    badge: AdminBadgeRow | null;
  } | null>(null);
  const [badgeForm, setBadgeForm] = useState({ name: "", icon: "", color: "", description: "" });

  const [announcementModal, setAnnouncementModal] = useState<{
    mode: "create" | "edit";
    announcement: AdminAnnouncementRow | null;
  } | null>(null);
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    body: "",
    active: true,
  });

  const [assignBadgeModal, setAssignBadgeModal] = useState<{
    user: AdminUserRow;
    badges: AdminBadgeRow[];
  } | null>(null);
  const [userAssignedBadges, setUserAssignedBadges] = useState<UserBadgeAssignment[]>([]);
  const [userBadgesLoading, setUserBadgesLoading] = useState(false);

  const [warnModal, setWarnModal] = useState<AdminUserRow | null>(null);
  const [warnReason, setWarnReason] = useState("");
  const [warnSeverity, setWarnSeverity] = useState<WarningSeverity>("medium");

  const [warningsModal, setWarningsModal] = useState<AdminUserRow | null>(null);
  const [warningsList, setWarningsList] = useState<AdminWarningRow[]>([]);
  const [warningsLoading, setWarningsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getAdminSession()
      .then((session) => {
        if (session.whitelistEnabled != null) {
          setWhitelistEnabled(session.whitelistEnabled);
        }
        if (session.pendingWhitelistCount != null) {
          setPendingWhitelist(session.pendingWhitelistCount);
        }
      })
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setError("");
    const firstLoad = !tabLoadedRef.current[tab];
    if (firstLoad) {
      setInitialLoading(true);
    } else {
      setFetching(true);
    }
    try {
      if (tab === "users") {
        const res = await listAdminUsers({
          search: search || undefined,
          whitelist: whitelistFilter === "all" ? undefined : whitelistFilter,
        });
        setUsers(res.users);
        setListTotal(res.total);
        setUserStats(res.stats ?? { total: res.total, active: 0, banned: 0 });
        setPendingWhitelist(res.pendingCount);
        setWhitelistEnabled(res.whitelistEnabled);
      } else if (tab === "channels") {
        const res = await listAdminChannels({ search: search || undefined });
        setChannels(res.channels);
        setListTotal(res.total);
      } else if (tab === "badges") {
        const res = await listBadges();
        setBadges(res.data);
        setListTotal(res.data.length);
      } else if (tab === "announcements") {
        const res = await listAdminAnnouncements();
        setAnnouncements(res.announcements);
        setListTotal(res.announcements.length);
      } else {
        const res = await listAdminChannelReports();
        setReports(res.reports);
        setListTotal(res.total ?? res.reports.length);
        setPendingReports(res.pendingCount);
      }
      tabLoadedRef.current[tab] = true;
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("admin.errors.loadFailed"),
      );
    } finally {
      setInitialLoading(false);
      setFetching(false);
    }
  }, [tab, search, whitelistFilter, t]);

  useEffect(() => {
    const t = setTimeout(() => loadData(), 200);
    return () => clearTimeout(t);
  }, [loadData]);

  const patchUserInList = useCallback(
    (userId: string, patch: Partial<AdminUserRow>) => {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)),
      );
      setReports((prev) =>
        prev.map((r) =>
          r.reporter.id === userId
            ? { ...r, reporter: { ...r.reporter, ...patch } }
            : r,
        ),
      );
      setAssignBadgeModal((prev) =>
        prev && prev.user.id === userId
          ? { ...prev, user: { ...prev.user, ...patch } }
          : prev,
      );
      setBanModal((prev) =>
        prev && prev.id === userId ? { ...prev, ...patch } : prev,
      );
      setWarnModal((prev) =>
        prev && prev.id === userId ? { ...prev, ...patch } : prev,
      );
      setWarningsModal((prev) =>
        prev && prev.id === userId ? { ...prev, ...patch } : prev,
      );
    },
    [],
  );

  useProfileSync(ws, {
    onInfo: ({ userId, username, displayName, color }) =>
      patchUserInList(userId, {
        ...(username != null ? { username } : {}),
        ...(displayName !== undefined ? { displayName } : {}),
        ...(color !== undefined ? { color } : {}),
      }),
    onImage: ({ userId, image }) => patchUserInList(userId, { image }),
  });

  const runAction = async (key: string, fn: () => Promise<unknown>) => {
    setActionLoading(key);
    setError("");
    try {
      await fn();
      await loadData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("admin.errors.operationFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const submitBan = async () => {
    if (!banModal) return;
    await runAction(`ban-${banModal.id}`, () =>
      banAdminUser(banModal.id, {
        reason: banReason.trim() || undefined,
      }),
    );
    setBanModal(null);
    setBanReason("");
  };

  const submitPasswordReset = async () => {
    if (!passwordModal) return;
    setPasswordFormError("");
    if (newPassword !== confirmPassword) {
      setPasswordFormError(t("admin.modals.resetPassword.mismatch"));
      return;
    }
    try {
      setActionLoading(`password-${passwordModal.id}`);
      setError("");
      await setAdminUserPassword(passwordModal.id, newPassword);
      setPasswordModal(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordFormError(
        err instanceof ApiError ? err.message : t("admin.errors.operationFailed"),
      );
    } finally {
      setActionLoading(null);
    }
  };

  const submitDelete = async () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    if (type === "user") {
      await runAction(`del-user-${id}`, () => deleteAdminUser(id));
    } else if (type === "badge") {
      await runAction(`del-badge-${id}`, () => deleteBadge(id));
    } else if (type === "announcement") {
      await runAction(`del-ann-${id}`, () => deleteAdminAnnouncement(id));
    } else if (type === "report") {
      await runAction(`del-report-${id}`, () => deleteAdminChannelReport(id));
    } else {
      await runAction(`del-ch-${id}`, () => deleteAdminChannel(id));
    }
    setConfirmDelete(null);
  };

  const submitBadge = async () => {
    if (!badgeModal) return;
    const { mode, badge } = badgeModal;
    const payload = {
      name: badgeForm.name.trim(),
      icon: badgeForm.icon.trim(),
      color: badgeForm.color.trim() || undefined,
      description: badgeForm.description.trim() || undefined,
    };

    if (!payload.name || !payload.icon) {
      setError(t("validation.badge.nameIconRequired"));
      return;
    }

    if (!isValidBadgeIcon(payload.icon)) {
      setError(t("validation.badge.invalidIcon"));
      return;
    }

    if (payload.color && !isValidBadgeColor(payload.color)) {
      setError(t("validation.badge.invalidColor"));
      return;
    }

    if (mode === "create") {
      await runAction("create-badge", () => createBadge(payload));
    } else if (badge) {
      await runAction(`edit-badge-${badge._id}`, () =>
        updateBadge(badge._id, payload),
      );
    }
    setBadgeModal(null);
    setBadgeForm({ name: "", icon: "", color: "", description: "" });
  };

  const submitAnnouncement = async () => {
    if (!announcementModal) return;
    const { mode, announcement } = announcementModal;
    const title = announcementForm.title.trim();
    const body = announcementForm.body.trim();
    if (!title || !body) {
      setError(t("validation.announcement.required"));
      return;
    }

    const payload = {
      title,
      body,
      active: announcementForm.active,
    };

    if (mode === "create") {
      await runAction("create-announcement", () => createAdminAnnouncement(payload));
    } else if (announcement) {
      await runAction(`edit-ann-${announcement.id}`, () =>
        updateAdminAnnouncement(announcement.id, payload),
      );
    }
    setAnnouncementModal(null);
    setAnnouncementForm({ title: "", body: "", active: true });
  };

  const loadUserAssignedBadges = useCallback(async (userId: string) => {
    setUserBadgesLoading(true);
    try {
      const res = await getUserBadges(userId);
      setUserAssignedBadges(res.data.badges ?? []);
    } catch {
      setUserAssignedBadges([]);
    } finally {
      setUserBadgesLoading(false);
    }
  }, []);

  const submitAssignBadge = async (badgeId: string) => {
    if (!assignBadgeModal || !badgeId) return;
    const { user } = assignBadgeModal;
    await runAction(`assign-badge-${user.id}-${badgeId}`, async () => {
      const res = await assignBadge(user.id, badgeId);
      setUserAssignedBadges(res.data.badges ?? []);
      return res;
    });
  };

  const submitRemoveUserBadge = async (assignmentId: string) => {
    if (!assignBadgeModal) return;
    const { user } = assignBadgeModal;
    await runAction(`remove-badge-${user.id}-${assignmentId}`, async () => {
      const res = await removeBadge(user.id, assignmentId);
      setUserAssignedBadges(res.data.badges ?? []);
      return res;
    });
  };

  const submitWarn = async () => {
    if (!warnModal) return;
    const reason = warnReason.trim();
    if (!reason) {
      setError(t("validation.warn.reasonRequired"));
      return;
    }
    const user = warnModal;
    await runAction(`warn-${user.id}`, () =>
      warnAdminUser(user.id, reason, warnSeverity),
    );
    setWarnModal(null);
    setWarnReason("");
    setWarnSeverity("medium");
  };

  const openWarnings = async (user: AdminUserRow) => {
    setWarningsModal(user);
    setWarningsList([]);
    setWarningsLoading(true);
    try {
      const res = await listAdminUserWarnings(user.id);
      setWarningsList(res.warnings);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : t("admin.modals.warnings.loadFailed"),
      );
    } finally {
      setWarningsLoading(false);
    }
  };

  const removeWarning = async (warningId: string) => {
    if (!warningsModal) return;
    const user = warningsModal;
    await runAction(`del-warning-${warningId}`, async () => {
      await deleteAdminUserWarning(user.id, warningId);
      setWarningsList((prev) => prev.filter((w) => w.id !== warningId));
    });
  };

  const resultCount = listTotal;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } finally {
      window.setTimeout(() => setRefreshing(false), 500);
    }
  };

  const tabTitle = t(`admin.tabs.${tab}`);
  const tabSubtitle =
    tab === "users"
      ? whitelistEnabled
        ? t("admin.tabs.usersSubtitleWhitelist")
        : t("admin.tabs.usersSubtitle")
      : t(`admin.tabs.${tab}Subtitle`);

  const showInitialLoading = (empty: boolean) =>
    initialLoading && !tabLoadedRef.current[tab] && empty;

  const renderList = () => {
    if (tab === "users") {
      if (showInitialLoading(users.length === 0)) {
        return (
          <div className="adm-placeholder">
            <div className="adm-placeholder-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div className="adm-placeholder-title">{t("common.loadingResults")}</div>
          </div>
        );
      }

      if (users.length === 0) {
        return (
          <div className="adm-placeholder">
            <div className="adm-placeholder-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
            </div>
            <div className="adm-placeholder-title">{t("admin.empty.noUsers")}</div>
            <div className="adm-placeholder-sub">{t("admin.empty.noUsersSub")}</div>
          </div>
        );
      }

      return (
        <AdminListWrap fetching={fetching}>
          <div className="adm-list">
            {users.map((u) => {
              const userMenuItems: AdminMenuItem[] = [];

              if (whitelistEnabled && !u.isWhitelisted) {
                userMenuItems.push({
                  key: "approve",
                  label: t("admin.users.approve"),
                  icon: <UserCheck size={16} />,
                  disabled: actionLoading === `whitelist-approve-${u.id}`,
                  onClick: () =>
                    runAction(`whitelist-approve-${u.id}`, () =>
                      setAdminUserWhitelist(u.id, true),
                    ),
                });
              }
              if (whitelistEnabled && u.isWhitelisted) {
                userMenuItems.push({
                  key: "revoke",
                  label: t("admin.users.revokeWhitelist"),
                  icon: <UserX size={16} />,
                  disabled: actionLoading === `whitelist-revoke-${u.id}`,
                  onClick: () =>
                    runAction(`whitelist-revoke-${u.id}`, () =>
                      setAdminUserWhitelist(u.id, false),
                    ),
                });
              }

              userMenuItems.push(
                {
                  key: "badge",
                  label: t("admin.users.assignBadge"),
                  icon: <Award size={16} />,
                  disabled: !!actionLoading?.includes(`assign-badge-${u.id}`),
                  onClick: () => {
                    setAssignBadgeModal({ user: u, badges });
                    setUserAssignedBadges([]);
                    void loadUserAssignedBadges(u.id);
                  },
                },
                {
                  key: "password",
                  label: t("admin.users.resetPassword"),
                  icon: <Key size={16} />,
                  disabled: actionLoading === `password-${u.id}`,
                  onClick: () => {
                    setPasswordModal(u);
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordFormError("");
                  },
                },
                {
                  key: "warn",
                  label: t("admin.users.warn"),
                  icon: <AlertTriangle size={16} />,
                  disabled: actionLoading === `warn-${u.id}`,
                  onClick: () => {
                    setWarnModal(u);
                    setWarnReason("");
                    setWarnSeverity("medium");
                  },
                },
              );

              if (u.warningCount > 0) {
                userMenuItems.push({
                  key: "warnings",
                  label: t("admin.users.warningsCount", { count: u.warningCount }),
                  icon: <List size={16} />,
                  onClick: () => openWarnings(u),
                });
              }

              if (u.isBlocked || u.isBanned) {
                userMenuItems.push({
                  key: "unban",
                  label: t("admin.users.unban"),
                  icon: <ShieldOff size={16} />,
                  disabled: actionLoading === `unban-${u.id}`,
                  onClick: () => runAction(`unban-${u.id}`, () => unbanAdminUser(u.id)),
                });
              } else {
                userMenuItems.push({
                  key: "ban",
                  label: t("admin.users.ban"),
                  icon: <Shield size={16} />,
                  danger: true,
                  onClick: () => {
                    setBanModal(u);
                    setBanReason(t("admin.users.defaultBanReason"));
                  },
                });
              }

              if (u.isDisabled) {
                userMenuItems.push({
                  key: "restore",
                  label: t("admin.users.restore"),
                  icon: <RotateCcw size={16} />,
                  disabled: actionLoading === `restore-${u.id}`,
                  onClick: () => runAction(`restore-${u.id}`, () => restoreAdminUser(u.id)),
                });
              }

              return (
            <article key={u.id} className="adm-card">
              <div className="adm-card-top">
                <AdminUserAvatar user={u} />
                <div className="adm-card-info">
                  <div className="adm-card-handle-row">
                    <span className="adm-card-handle">@{u.username}</span>
                    <UserStatusPill user={u} />
                    {whitelistEnabled && !u.isWhitelisted ? (
                      <span className="adm-status-pill adm-status-pill--pending">{t("admin.status.pending")}</span>
                    ) : null}
                    {whitelistEnabled && u.isWhitelisted ? (
                      <span className="adm-status-pill adm-status-pill--ok">{t("admin.status.approved")}</span>
                    ) : null}
                  </div>
                  {u.displayName ? (
                    <div className="adm-card-subtitle">{u.displayName}</div>
                  ) : null}
                  <div className="adm-card-meta">
                    <span>
                      <b>ID</b>
                      {u.id}
                    </span>
                    <span>
                      <b>{t("admin.users.joined")}</b>
                      {u.createdAt
                        ? new Date(u.createdAt).toLocaleDateString(dateLocale)
                        : t("common.emDash")}
                    </span>
                    {u.warningCount > 0 ? (
                      <span>
                        <b>{t("admin.users.warnings")}</b>
                        {u.warningCount}
                      </span>
                    ) : null}
                  </div>
                  {u.blockReason ? (
                    <div className="adm-card-note">{u.blockReason}</div>
                  ) : null}
                  {u.deletionScheduledAt ? (
                    <div className="adm-card-note">
                      {t("admin.users.deletionScheduled", {
                        date: new Date(u.deletionScheduledAt).toLocaleString(dateLocale),
                      })}
                    </div>
                  ) : null}
                  {u.isDisabled && !u.deletionScheduledAt ? (
                    <div className="adm-card-note">
                      {t("admin.users.disabledByUser")}
                      {u.disabledAt
                        ? ` (${new Date(u.disabledAt).toLocaleString(dateLocale)})`
                        : ""}
                      .
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="adm-card-actions adm-card-actions--split">
                <AdminActionMenu label={t("admin.actions.options")} items={userMenuItems} />
                <button
                  type="button"
                  className="adm-act-btn adm-act-btn--delete"
                  onClick={() =>
                    setConfirmDelete({
                      type: "user",
                      id: u.id,
                      label: `@${u.username}`,
                    })
                  }
                >
                  <Trash2 size={14} />
                  {t("common.delete")}
                </button>
              </div>
            </article>
              );
            })}
          </div>
        </AdminListWrap>
      );
    }

    if (tab === "channels") {
      if (showInitialLoading(channels.length === 0)) {
        return (
          <div className="adm-placeholder">
            <div className="adm-placeholder-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div className="adm-placeholder-title">{t("common.loadingResults")}</div>
          </div>
        );
      }

      if (channels.length === 0) {
        return (
          <div className="adm-placeholder">
            <div className="adm-placeholder-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
              </svg>
            </div>
            <div className="adm-placeholder-title">{t("admin.empty.noChannels")}</div>
            <div className="adm-placeholder-sub">{t("admin.empty.noChannelsSub")}</div>
          </div>
        );
      }

      return (
        <AdminListWrap fetching={fetching}>
          <div className="adm-list">
            {channels.map((ch) => (
              <article key={ch.id} className="adm-card">
                <div className="adm-card-top">
                  <AdminChannelAvatar name={ch.name} />
                  <div className="adm-card-info">
                    <div className="adm-card-handle-row">
                      <span className="adm-card-handle">#{ch.name}</span>
                      <span className="adm-status-pill adm-status-pill--neutral">
                        {ch.isPrivate ? t("common.private") : t("common.public")}
                      </span>
                    </div>
                    {ch.description ? (
                      <div className="adm-card-subtitle">{ch.description}</div>
                    ) : null}
                    <div className="adm-card-meta">
                      <span>
                        <b>{t("admin.users.owner")}</b>
                        {ch.admin ? `@${ch.admin.username}` : "—"}
                      </span>
                      <span>
                        <b>{t("admin.users.members")}</b>
                        {ch.memberCount}
                      </span>
                      <span>
                        <b>{t("admin.users.messages")}</b>
                        {ch.messageCount}
                      </span>
                      <span>
                        <b>{t("admin.users.created")}</b>
                        {ch.createdAt
                          ? new Date(ch.createdAt).toLocaleDateString(dateLocale)
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="adm-card-actions adm-card-actions--split">
                  <span />
                  <button
                    type="button"
                    className="adm-act-btn adm-act-btn--delete"
                    onClick={() =>
                      setConfirmDelete({
                        type: "channel",
                        id: ch.id,
                        label: `#${ch.name}`,
                      })
                    }
                  >
                    <Trash2 size={14} />
                    {t("admin.users.deleteChannel")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </AdminListWrap>
      );
    }

    if (tab === "badges") {
      if (showInitialLoading(badges.length === 0)) {
        return (
          <div className="adm-placeholder">
            <div className="adm-placeholder-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div className="adm-placeholder-title">{t("common.loadingResults")}</div>
          </div>
        );
      }

      if (badges.length === 0) {
        return (
          <div className="adm-placeholder">
            <div className="adm-placeholder-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 15 8 18v4l4-2 4 2v-4l-4-3z" />
                <path d="M8.5 8.5 12 2l3.5 6.5L12 11 8.5 8.5z" />
              </svg>
            </div>
            <div className="adm-placeholder-title">{t("admin.empty.noBadges")}</div>
            <div className="adm-placeholder-sub">{t("admin.empty.noBadgesSub")}</div>
          </div>
        );
      }

      return (
        <AdminListWrap fetching={fetching}>
          <div className="adm-list">
            {badges.map((b) => (
              <article key={b._id} className="adm-card">
                <div className="adm-card-top">
                  <div className="adm-card-badge-preview">
                    <BadgeComponent
                      name={b.name}
                      icon={b.icon}
                      color={b.color}
                      description={b.description}
                      size="lg"
                    />
                  </div>
                  <div className="adm-card-info">
                    <div className="adm-card-handle-row">
                      <span className="adm-card-handle">{b.name}</span>
                    </div>
                    {b.description ? (
                      <div className="adm-card-subtitle">{b.description}</div>
                    ) : null}
                    <div className="adm-card-meta">
                      <span>
                        <b>{t("common.icon")}</b>
                        {b.icon}
                      </span>
                      <span>
                        <b>{t("admin.users.created")}</b>
                        {b.createdAt
                          ? new Date(b.createdAt).toLocaleDateString(dateLocale)
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="adm-card-actions adm-card-actions--split">
                  <AdminActionMenu
                    label={t("admin.actions.options")}
                    items={[
                      {
                        key: "edit",
                        label: t("admin.users.edit"),
                        icon: <Pencil size={16} />,
                        onClick: () => {
                          setBadgeModal({ mode: "edit", badge: b });
                          setBadgeForm({
                            name: b.name,
                            icon: b.icon,
                            color: b.color || "",
                            description: b.description || "",
                          });
                        },
                      },
                    ]}
                  />
                  <button
                    type="button"
                    className="adm-act-btn adm-act-btn--delete"
                    onClick={() =>
                      setConfirmDelete({
                        type: "badge",
                        id: b._id,
                        label: b.name,
                      })
                    }
                  >
                    <Trash2 size={14} />
                    {t("common.delete")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </AdminListWrap>
      );
    }

    if (tab === "announcements") {
      if (showInitialLoading(announcements.length === 0)) {
        return (
          <div className="adm-placeholder">
            <div className="adm-placeholder-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div className="adm-placeholder-title">{t("common.loadingResults")}</div>
          </div>
        );
      }

      if (announcements.length === 0) {
        return (
          <div className="adm-placeholder">
            <div className="adm-placeholder-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11v2a1 1 0 0 0 1 1h1l3.5 7.5a1 1 0 0 0 1.8 0L14 14h5.5a1 1 0 0 0 .9-.6L22 8H6" />
              </svg>
            </div>
            <div className="adm-placeholder-title">{t("admin.empty.noAnnouncements")}</div>
            <div className="adm-placeholder-sub">{t("admin.empty.noAnnouncementsSub")}</div>
          </div>
        );
      }

      return (
        <AdminListWrap fetching={fetching}>
          <div className="adm-announce-list">
            {announcements.map((a) => (
              <article key={a.id} className="adm-announce-item">
                <div className="adm-announce-item-head">
                  <div className="adm-announce-item-icon">
                    <Megaphone size={18} strokeWidth={2.2} />
                  </div>
                  <div className="adm-announce-item-main">
                    <div className="adm-announce-item-title-row">
                      <h3 className="adm-announce-item-title">{a.title}</h3>
                      {a.active ? (
                        <span className="adm-status-pill adm-status-pill--ok">{t("admin.announcements.active")}</span>
                      ) : (
                        <span className="adm-status-pill adm-status-pill--neutral">{t("admin.announcements.inactive")}</span>
                      )}
                    </div>
                    {a.createdAt ? (
                      <div className="adm-announce-item-date">
                        {new Date(a.createdAt).toLocaleString(dateLocale)}
                      </div>
                    ) : null}
                    <div className="adm-announce-item-body">{a.body}</div>
                  </div>
                </div>
                <div className="adm-card-actions adm-card-actions--split adm-announce-item-actions">
                  <AdminActionMenu
                    label={t("admin.actions.options")}
                    items={[
                      {
                        key: "edit",
                        label: t("admin.users.edit"),
                        icon: <Pencil size={16} />,
                        onClick: () => {
                          setAnnouncementModal({ mode: "edit", announcement: a });
                          setAnnouncementForm({
                            title: a.title,
                            body: a.body,
                            active: a.active,
                          });
                        },
                      },
                      {
                        key: "toggle",
                        label: a.active
                          ? t("admin.announcements.deactivate")
                          : t("admin.announcements.activate"),
                        icon: a.active ? <ToggleLeft size={16} /> : <ToggleRight size={16} />,
                        disabled: actionLoading === `toggle-ann-${a.id}`,
                        onClick: () =>
                          runAction(`toggle-ann-${a.id}`, () =>
                            updateAdminAnnouncement(a.id, { active: !a.active }),
                          ),
                      },
                    ]}
                  />
                  <button
                    type="button"
                    className="adm-act-btn adm-act-btn--delete"
                    onClick={() =>
                      setConfirmDelete({
                        type: "announcement",
                        id: a.id,
                        label: a.title,
                      })
                    }
                  >
                    <Trash2 size={14} />
                    {t("common.delete")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </AdminListWrap>
      );
    }

    if (tab !== "reports") {
      return null;
    }

    if (showInitialLoading(reports.length === 0)) {
      return (
        <div className="adm-placeholder">
          <div className="adm-placeholder-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
          </div>
          <div className="adm-placeholder-title">{t("common.loadingResults")}</div>
        </div>
      );
    }

    if (reports.length === 0) {
      return (
        <div className="adm-placeholder">
          <div className="adm-placeholder-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
          </div>
          <div className="adm-placeholder-title">{t("admin.empty.noReports")}</div>
          <div className="adm-placeholder-sub">{t("admin.empty.noReportsSub")}</div>
        </div>
      );
    }

    return (
      <AdminListWrap fetching={fetching}>
        <div className="adm-list">
          {reports.map((r) => {
            const reportMenuItems: AdminMenuItem[] = [];

            if (r.status === "pending") {
              reportMenuItems.push(
                {
                  key: "review",
                  label: t("admin.users.review"),
                  icon: <CheckCircle size={16} />,
                  disabled: actionLoading === `rep-ok-${r.id}`,
                  onClick: () =>
                    runAction(`rep-ok-${r.id}`, () =>
                      updateAdminChannelReport(r.id, "reviewed"),
                    ),
                },
                {
                  key: "dismiss",
                  label: t("admin.users.dismiss"),
                  icon: <XCircle size={16} />,
                  disabled: actionLoading === `rep-dismiss-${r.id}`,
                  onClick: () =>
                    runAction(`rep-dismiss-${r.id}`, () =>
                      updateAdminChannelReport(r.id, "dismissed"),
                    ),
                },
                {
                  key: "delete-channel",
                  label: t("admin.users.deleteChannel"),
                  icon: <Trash2 size={16} />,
                  danger: true,
                  onClick: () =>
                    setConfirmDelete({
                      type: "channel",
                      id: r.channelId,
                      label: `#${r.channelName}`,
                    }),
                },
              );
            }

            return (
          <article key={r.id} className="adm-card">
            <div className="adm-card-top">
              <AdminChannelAvatar name={r.channelName} />
              <div className="adm-card-info">
                <div className="adm-card-handle-row">
                  <span className="adm-card-handle">#{r.channelName}</span>
                  <ReportStatusPill status={r.status} />
                </div>
                <div className="adm-card-subtitle">{r.reason}</div>
                <div className="adm-card-meta">
                  <span>
                    <b>{t("admin.users.reporter")}</b>
                    @{r.reporter.username}
                  </span>
                  <span>
                    <b>{t("common.date")}</b>
                    {r.createdAt
                      ? new Date(r.createdAt).toLocaleString(dateLocale)
                      : "—"}
                  </span>
                </div>
                {r.details ? <div className="adm-card-note">{r.details}</div> : null}
              </div>
            </div>
            <div className="adm-card-actions adm-card-actions--split">
              {reportMenuItems.length > 0 ? (
                <AdminActionMenu label={t("admin.actions.options")} items={reportMenuItems} />
              ) : (
                <span />
              )}
              <button
                type="button"
                className="adm-act-btn adm-act-btn--delete"
                onClick={() =>
                  setConfirmDelete({
                    type: "report",
                    id: r.id,
                    label: `#${r.channelName}`,
                  })
                }
              >
                <Trash2 size={14} />
                {t("admin.users.deleteReport")}
              </button>
            </div>
          </article>
            );
          })}
        </div>
      </AdminListWrap>
    );
  };

  return (
    <div className="adm-dash">
      <aside className="adm-sidebar">
        <AdminBrand />

        <nav>
          <button
            type="button"
            className={`adm-nav-item${tab === "users" ? " active" : ""}`}
            onClick={() => setTab("users")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            {t("admin.tabs.users")}
            {whitelistEnabled && pendingWhitelist > 0 ? (
              <span className="adm-nav-badge">{pendingWhitelist}</span>
            ) : null}
          </button>
          <button
            type="button"
            className={`adm-nav-item${tab === "channels" ? " active" : ""}`}
            onClick={() => setTab("channels")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18" />
            </svg>
            {t("admin.tabs.channels")}
          </button>
          <button
            type="button"
            className={`adm-nav-item${tab === "badges" ? " active" : ""}`}
            onClick={() => setTab("badges")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 15 8 18v4l4-2 4 2v-4l-4-3z" />
              <path d="M8.5 8.5 12 2l3.5 6.5L12 11 8.5 8.5z" />
            </svg>
            {t("admin.tabs.badges")}
          </button>
          <button
            type="button"
            className={`adm-nav-item${tab === "announcements" ? " active" : ""}`}
            onClick={() => setTab("announcements")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 11v2a1 1 0 0 0 1 1h1l3.5 7.5a1 1 0 0 0 1.8 0L14 14h5.5a1 1 0 0 0 .9-.6L22 8H6" />
            </svg>
            {t("admin.tabs.announcements")}
          </button>
          <button
            type="button"
            className={`adm-nav-item${tab === "reports" ? " active" : ""}`}
            onClick={() => setTab("reports")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
              <line x1="4" y1="22" x2="4" y2="15" />
            </svg>
            {t("admin.tabs.reports")}
            {pendingReports > 0 ? (
              <span className="adm-nav-badge">{pendingReports}</span>
            ) : null}
          </button>
        </nav>

        <div className="adm-sidebar-footer">
          <button
            type="button"
            className="adm-nav-item adm-nav-item--logout"
            onClick={onClose}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
            {t("common.closePanel")}
          </button>
        </div>
      </aside>

      <main className="adm-dash-main">
        <header className="adm-dash-header">
          <div>
            <h1>{tabTitle}</h1>
            <p>{tabSubtitle}</p>
          </div>
          <button
            type="button"
            className="adm-dash-close"
            onClick={onClose}
            title={t("common.close")}
            aria-label={t("common.close")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {error ? <div className="adm-dash-error">{error}</div> : null}

        {tab === "users" ? (
          <div
            className={`adm-whitelist-banner${whitelistEnabled ? " adm-whitelist-banner--enabled" : ""}`}
            role="status"
          >
            <div className="adm-whitelist-banner-title">
              {whitelistEnabled
                ? t("admin.whitelist.enabledTitle")
                : t("admin.whitelist.disabledTitle")}
            </div>
            <p>
              {whitelistEnabled
                ? t("admin.whitelist.enabledBody", { count: pendingWhitelist })
                : t("admin.whitelist.disabledBody")}
            </p>
          </div>
        ) : null}

        {tab === "users" ? (
          <div className="adm-stat-row">
            <div className="adm-stat-card adm-stat-card--accent">
              <div className="n">{userStats.total}</div>
              <div className="l">{t("admin.stats.total")}</div>
            </div>
            <div className="adm-stat-card adm-stat-card--ok">
              <div className="n">{userStats.active}</div>
              <div className="l">{t("admin.stats.active")}</div>
            </div>
            <div className="adm-stat-card adm-stat-card--danger">
              <div className="n">{userStats.banned}</div>
              <div className="l">{t("admin.stats.banned")}</div>
            </div>
            {whitelistEnabled ? (
              <div className="adm-stat-card adm-stat-card--pending">
                <div className="n">{pendingWhitelist}</div>
                <div className="l">{t("admin.stats.pendingWhitelist")}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="adm-toolbar">
          {(tab === "users" || tab === "channels") && (
            <div className="adm-search-wrap">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                id="admin-search"
                type="search"
                placeholder={tab === "users" ? t("admin.toolbar.searchUser") : t("admin.toolbar.searchChannel")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label={tab === "users" ? t("admin.toolbar.searchUserAria") : t("admin.toolbar.searchChannelAria")}
              />
            </div>
          )}

          {tab === "users" && whitelistEnabled ? (
            <select
              id="whitelist-filter"
              className="adm-filter-select"
              value={whitelistFilter}
              onChange={(e) =>
                setWhitelistFilter(e.target.value as "all" | "pending" | "approved")
              }
              aria-label={t("admin.toolbar.whitelistFilter")}
            >
              <option value="all">{t("admin.toolbar.whitelistAll")}</option>
              <option value="pending">{t("admin.toolbar.whitelistPending")}</option>
              <option value="approved">{t("admin.toolbar.whitelistApproved")}</option>
            </select>
          ) : null}

          <div className="adm-result-count">
            {t("admin.toolbar.results")}: <b>{resultCount}</b>
          </div>

          {tab === "badges" ? (
            <button
              type="button"
              className="adm-tb-btn adm-tb-btn--primary"
              onClick={() => {
                setBadgeModal({ mode: "create", badge: null });
                setBadgeForm({ name: "", icon: "", color: "", description: "" });
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t("admin.toolbar.createBadge")}
            </button>
          ) : null}

          {tab === "announcements" ? (
            <button
              type="button"
              className="adm-tb-btn adm-tb-btn--primary"
              onClick={() => {
                setAnnouncementModal({ mode: "create", announcement: null });
                setAnnouncementForm({ title: "", body: "", active: true });
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              {t("admin.toolbar.createAnnouncement")}
            </button>
          ) : null}

          <button
            type="button"
            className={`adm-tb-btn adm-tb-btn--primary${refreshing ? " spin" : ""}`}
            onClick={handleRefresh}
            disabled={fetching || refreshing || initialLoading}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
            {t("admin.toolbar.refresh")}
          </button>
        </div>

        {renderList()}
      </main>

      {banModal ? (
        <div className="adm-overlay" onClick={() => setBanModal(null)}>
          <div className="adm-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{t("admin.modals.ban.title")}</h2>
            <p>
              {t("admin.modals.ban.body", { username: banModal.username })}
            </p>
            <div className="adm-field">
              <label htmlFor="ban-reason">{t("admin.modals.ban.reason")}</label>
              <textarea
                id="ban-reason"
                rows={3}
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder={t("admin.modals.ban.reasonPlaceholder")}
              />
            </div>
            <div className="adm-dialog-footer">
              <button
                type="button"
                className="adm-act-btn adm-act-btn--ghost"
                onClick={() => setBanModal(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="adm-act-btn adm-act-btn--danger"
                disabled={actionLoading === `ban-${banModal.id}`}
                onClick={submitBan}
              >
                {t("admin.modals.ban.submit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordModal ? (
        <div
          className="adm-overlay"
          onClick={() => {
            setPasswordModal(null);
            setPasswordFormError("");
          }}
        >
          <div className="adm-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{t("admin.modals.resetPassword.title")}</h2>
            <p>
              {t("admin.modals.resetPassword.body", {
                username: passwordModal.username,
              })}
            </p>
            <div className="adm-field">
              <label htmlFor="admin-new-password">
                {t("admin.modals.resetPassword.password")}
              </label>
              <input
                id="admin-new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder={t("admin.modals.resetPassword.passwordPlaceholder")}
              />
            </div>
            <div className="adm-field">
              <label htmlFor="admin-confirm-password">
                {t("admin.modals.resetPassword.confirm")}
              </label>
              <input
                id="admin-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {passwordFormError ? (
              <p className="adm-form-error" role="alert">
                {passwordFormError}
              </p>
            ) : null}
            <div className="adm-dialog-footer">
              <button
                type="button"
                className="adm-act-btn adm-act-btn--ghost"
                onClick={() => {
                  setPasswordModal(null);
                  setPasswordFormError("");
                }}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="adm-act-btn adm-act-btn--danger"
                disabled={
                  actionLoading === `password-${passwordModal.id}` ||
                  !newPassword.trim() ||
                  !confirmPassword.trim()
                }
                onClick={() => void submitPasswordReset()}
              >
                {t("admin.modals.resetPassword.submit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="adm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="adm-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{t("admin.modals.delete.title")}</h2>
            <p>
              {t("admin.modals.delete.body", { label: confirmDelete.label })}
            </p>
            <div className="adm-dialog-footer">
              <button
                type="button"
                className="adm-act-btn adm-act-btn--ghost"
                onClick={() => setConfirmDelete(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="adm-act-btn adm-act-btn--danger"
                disabled={
                  actionLoading === `del-user-${confirmDelete.id}` ||
                  actionLoading === `del-ch-${confirmDelete.id}` ||
                  actionLoading === `del-badge-${confirmDelete.id}` ||
                  actionLoading === `del-ann-${confirmDelete.id}` ||
                  actionLoading === `del-report-${confirmDelete.id}`
                }
                onClick={submitDelete}
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {badgeModal ? (
        <div className="adm-overlay" onClick={() => setBadgeModal(null)}>
          <div className="adm-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{badgeModal.mode === "create" ? t("admin.modals.badge.createTitle") : t("admin.modals.badge.editTitle")}</h2>
            <div className="adm-field">
              <label htmlFor="badge-name">{t("admin.modals.badge.name")}</label>
              <input
                id="badge-name"
                type="text"
                value={badgeForm.name}
                onChange={(e) =>
                  setBadgeForm({ ...badgeForm, name: e.target.value })
                }
                placeholder={t("admin.modals.badge.namePlaceholder")}
              />
            </div>
            <div className="adm-field">
              <label htmlFor="badge-icon">{t("admin.modals.badge.icon")}</label>
              <input
                id="badge-icon"
                type="text"
                value={badgeForm.icon}
                onChange={(e) =>
                  setBadgeForm({ ...badgeForm, icon: e.target.value })
                }
                placeholder={t("admin.modals.badge.iconPlaceholder")}
              />
              <small>{t("admin.modals.badge.iconHint")}</small>
            </div>
            <div className="adm-field">
              <label htmlFor="badge-color">{t("admin.modals.badge.color")}</label>
              <input
                id="badge-color"
                type="text"
                value={badgeForm.color}
                onChange={(e) =>
                  setBadgeForm({ ...badgeForm, color: e.target.value })
                }
                placeholder={t("admin.modals.badge.colorPlaceholder")}
              />
            </div>
            <div className="adm-field">
              <label htmlFor="badge-description">{t("admin.modals.badge.description")}</label>
              <input
                id="badge-description"
                type="text"
                value={badgeForm.description}
                onChange={(e) =>
                  setBadgeForm({ ...badgeForm, description: e.target.value })
                }
                placeholder={t("admin.modals.badge.descriptionPlaceholder")}
              />
            </div>
            <div className="adm-dialog-footer">
              <button
                type="button"
                className="adm-act-btn adm-act-btn--ghost"
                onClick={() => setBadgeModal(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="adm-tb-btn adm-tb-btn--primary"
                disabled={
                  actionLoading?.includes("badge") ||
                  !badgeForm.name.trim() ||
                  !badgeForm.icon.trim()
                }
                onClick={submitBadge}
              >
                {badgeModal.mode === "create" ? t("common.create") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {announcementModal ? (
        <div className="adm-overlay" onClick={() => setAnnouncementModal(null)}>
          <div
            className="adm-dialog adm-dialog--wide adm-dialog--announcement"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="adm-announce-dialog-head">
              <div className="adm-announce-item-icon">
                <Megaphone size={20} strokeWidth={2.2} />
              </div>
              <div>
                <h2>
                  {announcementModal.mode === "create"
                    ? t("admin.modals.announcement.createTitle")
                    : t("admin.modals.announcement.editTitle")}
                </h2>
                <p className="adm-lead">{t("admin.modals.announcement.lead")}</p>
              </div>
            </div>
            <div className="adm-field">
              <label htmlFor="announcement-title">{t("admin.modals.announcement.title")}</label>
              <input
                id="announcement-title"
                type="text"
                value={announcementForm.title}
                onChange={(e) =>
                  setAnnouncementForm({ ...announcementForm, title: e.target.value })
                }
                placeholder={t("admin.modals.announcement.titlePlaceholder")}
                maxLength={120}
              />
            </div>
            <div className="adm-field">
              <label htmlFor="announcement-body">{t("admin.modals.announcement.body")}</label>
              <textarea
                id="announcement-body"
                rows={8}
                value={announcementForm.body}
                onChange={(e) =>
                  setAnnouncementForm({ ...announcementForm, body: e.target.value })
                }
                placeholder={t("admin.modals.announcement.bodyPlaceholder")}
              />
            </div>
            <label className="adm-checkbox-row">
              <input
                type="checkbox"
                checked={announcementForm.active}
                onChange={(e) =>
                  setAnnouncementForm({ ...announcementForm, active: e.target.checked })
                }
              />
              <span>{t("admin.modals.announcement.active")}</span>
            </label>
            <div className="adm-dialog-footer">
              <button
                type="button"
                className="adm-act-btn adm-act-btn--ghost"
                onClick={() => setAnnouncementModal(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="adm-tb-btn adm-tb-btn--primary"
                disabled={
                  actionLoading?.includes("announcement") ||
                  !announcementForm.title.trim() ||
                  !announcementForm.body.trim()
                }
                onClick={submitAnnouncement}
              >
                {announcementModal.mode === "create" ? t("admin.modals.announcement.publish") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {assignBadgeModal ? (
        <div className="adm-overlay" onClick={() => setAssignBadgeModal(null)}>
          <div className="adm-dialog adm-dialog--badges" onClick={(e) => e.stopPropagation()}>
            <div className="adm-badge-modal-head">
              <div className="adm-badge-modal-head-main">
                <AdminUserAvatar user={assignBadgeModal.user} size={40} />
                <div>
                  <h2>{t("admin.modals.assignBadge.title")}</h2>
                  <p>
                    {t("admin.modals.assignBadge.hint", {
                      username: assignBadgeModal.user.username,
                    })}
                  </p>
                </div>
              </div>
              <span className="adm-badge-modal-count">
                {userAssignedBadges.length}{" "}
                {t("presence.badge", { count: userAssignedBadges.length })}
              </span>
            </div>

            <section className="adm-badge-section">
              <h3>{t("admin.modals.assignBadge.assigned")}</h3>
              {userBadgesLoading ? (
                <p className="adm-badge-empty">{t("admin.modals.assignBadge.loading")}</p>
              ) : userAssignedBadges.length === 0 ? (
                <p className="adm-badge-empty">
                  {t("admin.modals.assignBadge.empty")}
                </p>
              ) : (
                <div className="adm-assigned-badges-grid">
                  {userAssignedBadges.map((badge, index) => {
                    const meta = badge.badgeId;
                    if (!meta) return null;
                    return (
                      <article
                        key={badge._id ?? `${meta._id}-${index}`}
                        className="adm-assigned-badge-card"
                      >
                        <div className="adm-assigned-badge-top">
                          <BadgeComponent
                            name={meta.name}
                            icon={meta.icon}
                            color={meta.color}
                            description={meta.description}
                            size="lg"
                            tooltipPlacement="bottom"
                          />
                          <div className="adm-assigned-badge-info">
                            <strong>{meta.name}</strong>
                            {meta.description ? (
                              <span>{meta.description}</span>
                            ) : null}
                          </div>
                        </div>
                        <div className="adm-assigned-badge-footer">
                          <time dateTime={badge.assignedAt}>
                            {t("admin.modals.assignBadge.assignedAt", {
                              date: formatAssignedDate(badge.assignedAt, dateLocale, emDash),
                            })}
                          </time>
                          <button
                            type="button"
                            className="adm-act-btn adm-act-btn--delete"
                            disabled={
                              !badge._id ||
                              actionLoading ===
                                `remove-badge-${assignBadgeModal.user.id}-${badge._id}`
                            }
                            onClick={() =>
                              badge._id && submitRemoveUserBadge(badge._id)
                            }
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="adm-badge-section">
              <h3>{t("admin.modals.assignBadge.add")}</h3>
              {assignBadgeModal.badges.length === 0 ? (
                <p className="adm-badge-empty">
                  {t("admin.modals.assignBadge.noBadges")}
                </p>
              ) : (
                <div className="adm-badge-assign-grid">
                  {assignBadgeModal.badges.map((badge) => {
                    const alreadyAssigned = userAssignedBadges.some(
                      (item) => item.badgeId?._id === badge._id,
                    );
                    const loading =
                      actionLoading ===
                      `assign-badge-${assignBadgeModal.user.id}-${badge._id}`;
                    return (
                      <button
                        key={badge._id}
                        type="button"
                        className={`adm-badge-assign-card${alreadyAssigned ? " adm-badge-assign-card--assigned" : ""}`}
                        disabled={loading || alreadyAssigned}
                        onClick={() => submitAssignBadge(badge._id)}
                      >
                        <BadgeComponent
                          name={badge.name}
                          icon={badge.icon}
                          color={badge.color}
                          description={badge.description}
                          size="lg"
                          tooltipPlacement="bottom"
                        />
                        <span className="adm-badge-assign-name">{badge.name}</span>
                        {badge.description ? (
                          <span className="adm-badge-assign-desc">
                            {badge.description}
                          </span>
                        ) : null}
                        {alreadyAssigned ? (
                          <span className="adm-badge-assign-count">{t("admin.modals.assignBadge.alreadyAssigned")}</span>
                        ) : (
                          <span className="adm-badge-assign-hint">{t("admin.modals.assignBadge.clickToAssign")}</span>
                        )}
                        {loading ? (
                          <span className="adm-badge-assign-loading">{t("common.assigning")}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            <div className="adm-dialog-footer">
              <button
                type="button"
                className="adm-act-btn adm-act-btn--ghost"
                onClick={() => setAssignBadgeModal(null)}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {warnModal ? (
        <div className="adm-overlay" onClick={() => setWarnModal(null)}>
          <div className="adm-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{t("admin.modals.warn.title")}</h2>
            <p>
              {t("admin.modals.warn.body", { username: warnModal.username })}
            </p>
            <div className="adm-field">
              <label htmlFor="warn-severity">{t("admin.modals.warn.severity")}</label>
              <select
                id="warn-severity"
                value={warnSeverity}
                onChange={(e) => setWarnSeverity(e.target.value as WarningSeverity)}
              >
                <option value="low">{t("admin.modals.warn.severityLow")}</option>
                <option value="medium">{t("admin.modals.warn.severityMedium")}</option>
                <option value="high">{t("admin.modals.warn.severityHigh")}</option>
              </select>
            </div>
            <div className="adm-field">
              <label htmlFor="warn-reason">{t("common.reason")}</label>
              <textarea
                id="warn-reason"
                rows={4}
                value={warnReason}
                onChange={(e) => setWarnReason(e.target.value)}
                placeholder={t("admin.modals.warn.reasonPlaceholder")}
                maxLength={1000}
              />
            </div>
            <div className="adm-dialog-footer">
              <button
                type="button"
                className="adm-act-btn adm-act-btn--ghost"
                onClick={() => setWarnModal(null)}
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                className="adm-act-btn adm-act-btn--warn"
                disabled={
                  actionLoading === `warn-${warnModal.id}` || !warnReason.trim()
                }
                onClick={submitWarn}
              >
                {t("admin.modals.warn.submit")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {warningsModal ? (
        <div className="adm-overlay" onClick={() => setWarningsModal(null)}>
          <div className="adm-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>{t("admin.modals.warnings.title", { username: warningsModal.username })}</h2>
            {warningsLoading ? (
              <p>{t("common.loading")}</p>
            ) : warningsList.length === 0 ? (
              <p>{t("admin.empty.noWarnings")}</p>
            ) : (
              <div className="adm-warning-list">
                {warningsList.map((w) => (
                  <div key={w.id} className="adm-warning-item">
                    <div className="adm-warning-item-head">
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <SeverityPill severity={w.severity} />
                        {w.acknowledged ? (
                          <span className="adm-status-pill adm-status-pill--ok">{t("common.acknowledged")}</span>
                        ) : (
                          <span className="adm-status-pill adm-status-pill--warned">{t("common.unread")}</span>
                        )}
                      </div>
                      <span className="adm-warning-date">
                        {w.createdAt
                          ? new Date(w.createdAt).toLocaleString(dateLocale)
                          : "—"}
                      </span>
                    </div>
                    <div className="adm-warning-reason">{w.reason}</div>
                    <div className="adm-actions">
                      <button
                        type="button"
                        className="adm-act-btn adm-act-btn--danger"
                        disabled={actionLoading === `del-warning-${w.id}`}
                        onClick={() => removeWarning(w.id)}
                      >
                        {t("admin.modals.warnings.delete")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="adm-dialog-footer">
              <button
                type="button"
                className="adm-act-btn adm-act-btn--ghost"
                onClick={() => setWarningsModal(null)}
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}