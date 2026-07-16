import { apiRequest } from "./client";

export interface AdminUserRow {
  id: string;
  username: string;
  displayName: string | null;
  image?: string | null;
  color?: number | null;
  isActive: boolean;
  isBlocked: boolean;
  isBanned: boolean;
  isDisabled: boolean;
  disabledAt: string | null;
  deletionRequestedAt: string | null;
  deletionScheduledAt: string | null;
  blockReason: string | null;
  blockedAt: string | null;
  isWhitelisted: boolean;
  warningCount: number;
  createdAt: string | null;
}

export type WarningSeverity = "low" | "medium" | "high";

export interface AdminWarningRow {
  id: string;
  reason: string;
  severity: WarningSeverity;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string | null;
}

export interface AdminChannelRow {
  id: string;
  name: string;
  description: string;
  isPrivate: boolean;
  memberCount: number;
  messageCount: number;
  admin: { id: string; username: string; displayName: string | null } | null;
  createdAt: string | null;
}

export interface AdminBadgeRow {
  _id: string;
  name: string;
  icon: string;
  color: string | null;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AdminSessionReason = "not_logged_in" | "forbidden" | "not_configured";

export function getAdminSession() {
  return apiRequest<{
    authenticated: boolean;
    configured?: boolean;
    reason?: AdminSessionReason;
    userId?: string;
    username?: string;
    whitelistEnabled?: boolean;
    pendingWhitelistCount?: number;
  }>("/api/admin/session");
}

export function listAdminUsers(params?: {
  page?: number;
  search?: string;
  whitelist?: "pending" | "approved";
}) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.search) q.set("search", params.search);
  if (params?.whitelist) q.set("whitelist", params.whitelist);
  const qs = q.toString();
  return apiRequest<{
    users: AdminUserRow[];
    total: number;
    page: number;
    limit: number;
    pendingCount: number;
    whitelistEnabled: boolean;
  }>(`/api/admin/users${qs ? `?${qs}` : ""}`);
}

export function setAdminUserWhitelist(userId: string, approved: boolean) {
  return apiRequest<{ message: string }>(`/api/admin/users/${userId}/whitelist`, {
    method: "PATCH",
    body: JSON.stringify({ approved }),
  });
}

export function setAdminUserPassword(userId: string, newPassword: string) {
  return apiRequest<{ message: string; user: { id: string; username: string } }>(
    `/api/admin/users/${userId}/password`,
    {
      method: "PATCH",
      body: JSON.stringify({ newPassword }),
    },
  );
}

export function banAdminUser(
  userId: string,
  options?: { reason?: string },
) {
  return apiRequest<{ message: string }>(`/api/admin/users/${userId}/block`, {
    method: "PATCH",
    body: JSON.stringify(options ?? {}),
  });
}

export function unbanAdminUser(userId: string) {
  return apiRequest<{ message: string }>(
    `/api/admin/users/${userId}/unblock`,
    { method: "PATCH" },
  );
}

export function restoreAdminUser(userId: string) {
  return apiRequest<{ message: string }>(
    `/api/admin/users/${userId}/restore`,
    { method: "PATCH" },
  );
}

export function deleteAdminUser(userId: string) {
  return apiRequest<{ message: string }>(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });
}

export function warnAdminUser(
  userId: string,
  reason: string,
  severity: WarningSeverity = "medium",
) {
  return apiRequest<{
    message: string;
    warning: AdminWarningRow;
    warningCount: number;
  }>(`/api/admin/users/${userId}/warnings`, {
    method: "POST",
    body: JSON.stringify({ reason, severity }),
  });
}

export function listAdminUserWarnings(userId: string) {
  return apiRequest<{
    warnings: AdminWarningRow[];
    total: number;
    unacknowledged: number;
  }>(`/api/admin/users/${userId}/warnings`);
}

export function deleteAdminUserWarning(userId: string, warningId: string) {
  return apiRequest<{ message: string; warningCount: number }>(
    `/api/admin/users/${userId}/warnings/${warningId}`,
    { method: "DELETE" },
  );
}

export function listAdminChannels(params?: { page?: number; search?: string }) {
  const q = new URLSearchParams();
  if (params?.page) q.set("page", String(params.page));
  if (params?.search) q.set("search", params.search);
  const qs = q.toString();
  return apiRequest<{
    channels: AdminChannelRow[];
    total: number;
    page: number;
    limit: number;
  }>(`/api/admin/channels${qs ? `?${qs}` : ""}`);
}

export function deleteAdminChannel(channelId: string) {
  return apiRequest<{ message: string }>(`/api/admin/channels/${channelId}`, {
    method: "DELETE",
  });
}

export interface AdminChannelReportRow {
  id: string;
  channelId: string;
  channelName: string;
  reason: string;
  details: string;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
  reporter: {
    id: string;
    username: string;
    displayName: string | null;
    image?: string | null;
    color?: number | null;
  };
}

export function listAdminChannelReports() {
  return apiRequest<{
    reports: AdminChannelReportRow[];
    pendingCount: number;
  }>("/api/admin/reports");
}

export function updateAdminChannelReport(
  reportId: string,
  status: "reviewed" | "dismissed",
) {
  return apiRequest<{ message: string }>(`/api/admin/reports/${reportId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function listBadges() {
  return apiRequest<{ success: boolean; data: AdminBadgeRow[] }>(
    "/api/admin/badges",
  );
}

export function createBadge(badge: {
  name: string;
  icon: string;
  color?: string;
  description?: string;
}) {
  return apiRequest<{ success: boolean; data: AdminBadgeRow }>(
    "/api/admin/badges",
    {
      method: "POST",
      body: JSON.stringify(badge),
    },
  );
}

export function updateBadge(
  badgeId: string,
  updates: {
    name?: string;
    icon?: string;
    color?: string;
    description?: string;
  },
) {
  return apiRequest<{ success: boolean; data: AdminBadgeRow }>(
    `/api/admin/badges/${badgeId}`,
    {
      method: "PUT",
      body: JSON.stringify(updates),
    },
  );
}

export function deleteBadge(badgeId: string) {
  return apiRequest<{ success: boolean; message: string }>(
    `/api/admin/badges/${badgeId}`,
    {
      method: "DELETE",
    },
  );
}

export interface AdminAnnouncementRow {
  id: string;
  title: string;
  body: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export function listAdminAnnouncements() {
  return apiRequest<{ announcements: AdminAnnouncementRow[] }>(
    "/api/admin/announcements",
  );
}

export function createAdminAnnouncement(payload: {
  title: string;
  body: string;
  active?: boolean;
}) {
  return apiRequest<{ message: string; announcement: AdminAnnouncementRow }>(
    "/api/admin/announcements",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export function updateAdminAnnouncement(
  announcementId: string,
  payload: {
    title?: string;
    body?: string;
    active?: boolean;
  },
) {
  return apiRequest<{ message: string; announcement: AdminAnnouncementRow }>(
    `/api/admin/announcements/${announcementId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export function deleteAdminAnnouncement(announcementId: string) {
  return apiRequest<{ message: string }>(
    `/api/admin/announcements/${announcementId}`,
    { method: "DELETE" },
  );
}

export function assignBadge(userId: string, badgeId: string) {
  return apiRequest<{ success: boolean; data: UserBadgeAssignmentData }>(
    `/api/admin/users/${userId}/assign-badge`,
    {
      method: "POST",
      body: JSON.stringify({ badgeId }),
    },
  );
}

export interface UserBadgeAssignment {
  _id?: string;
  badgeId?: {
    _id: string;
    name: string;
    icon: string;
    color: string | null;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  };
  assignedAt?: string;
}

export interface UserBadgeAssignmentData {
  badges: UserBadgeAssignment[];
  featuredBadgeIds?: string[];
  _id?: string;
  username?: string;
}

export function getUserBadges(userId: string) {
  return apiRequest<{ success: boolean; data: UserBadgeAssignmentData }>(
    `/api/admin/users/${userId}/badges`,
  );
}

export function removeBadge(userId: string, assignmentId: string) {
  return apiRequest<{ success: boolean; data: UserBadgeAssignmentData }>(
    `/api/admin/users/${userId}/badges/${assignmentId}`,
    {
      method: "DELETE",
    },
  );
}

