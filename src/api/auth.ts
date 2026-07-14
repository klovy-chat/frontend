import { apiRequest } from "./client";
import { assertAvatarSize } from "../constants/upload";
import type { User } from "../types";

export interface AuthResponse {
  user: User;
  message?: string;
}

export interface LoginSuccessResponse {
  user: User;
}

export interface LoginTwoFactorResponse {
  requiresTwoFactor: true;
  twoFactorToken: string;
}

export type LoginResponse = LoginSuccessResponse | LoginTwoFactorResponse;

export function isTwoFactorLoginResponse(
  response: LoginResponse,
): response is LoginTwoFactorResponse {
  return "requiresTwoFactor" in response && response.requiresTwoFactor === true;
}

export function login(
  username: string,
  password: string,
  turnstileToken: string,
) {
  return apiRequest<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password, turnstileToken }),
  });
}

export function verifyTwoFactorLogin(
  twoFactorToken: string,
  code: string,
  turnstileToken: string,
) {
  return apiRequest<LoginSuccessResponse>("/api/auth/login/2fa", {
    method: "POST",
    body: JSON.stringify({ twoFactorToken, code, turnstileToken }),
  });
}

export function setupTwoFactor(password: string) {
  return apiRequest<{ secret: string; otpauthUrl: string }>(
    "/api/auth/2fa/setup",
    {
      method: "POST",
      body: JSON.stringify({ password }),
    },
  );
}

export function enableTwoFactor(password: string, code: string) {
  return apiRequest<{
    message: string;
    twoFactorEnabled: boolean;
    backupCodes: string[];
  }>("/api/auth/2fa/enable", {
    method: "POST",
    body: JSON.stringify({ password, code }),
  });
}

export function disableTwoFactor(password: string, code: string) {
  return apiRequest<{ message: string; twoFactorEnabled: boolean }>(
    "/api/auth/2fa/disable",
    {
      method: "POST",
      body: JSON.stringify({ password, code }),
    },
  );
}

export function signup(
  username: string,
  password: string,
  turnstileToken: string,
  language?: string,
) {
  return apiRequest<AuthResponse>("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ username, password, turnstileToken, language }),
  });
}

export function changePassword(
  currentPassword: string,
  newPassword: string,
  code?: string,
) {
  return apiRequest<LoginSuccessResponse>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      currentPassword,
      newPassword,
      ...(code ? { code } : {}),
    }),
  });
}

export function logout() {
  return apiRequest<void>("/api/auth/logout", { method: "POST" });
}

export function refreshSession() {
  return apiRequest<LoginSuccessResponse>("/api/auth/refresh", {
    method: "POST",
  });
}

export function getUserInfo() {
  return apiRequest<User>("/api/auth/userinfo");
}

export type WarningSeverity = "low" | "medium" | "high";

export interface OwnWarning {
  id: string;
  reason: string;
  severity: WarningSeverity;
  acknowledged: boolean;
  acknowledgedAt: string | null;
  createdAt: string | null;
}

export function getMyWarnings() {
  return apiRequest<{
    warnings: OwnWarning[];
    total: number;
    unacknowledged: number;
  }>("/api/auth/warnings");
}

export function acknowledgeMyWarnings() {
  return apiRequest<{ message: string; acknowledged: number }>(
    "/api/auth/warnings/acknowledge",
    { method: "POST" },
  );
}

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export function getMyAnnouncements() {
  return apiRequest<{
    announcements: AnnouncementItem[];
    total: number;
  }>("/api/auth/announcements");
}

export function dismissAnnouncements(announcementIds: string[]) {
  return apiRequest<{ message: string; dismissed: number }>(
    "/api/auth/announcements/dismiss",
    {
      method: "POST",
      body: JSON.stringify({ announcementIds }),
    },
  );
}

export function updateProfile(data: {
  displayName: string;
  bio?: string;
  color?: number;
}) {
  return apiRequest<User>("/api/auth/update-profile", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateLanguage(language: "pl" | "en") {
  return apiRequest<User>("/api/auth/language", {
    method: "PATCH",
    body: JSON.stringify({ language }),
  });
}

export function changeUsername(
  username: string,
  password: string,
  code?: string,
) {
  return apiRequest<User>("/api/auth/change-username", {
    method: "POST",
    body: JSON.stringify({
      username,
      password,
      ...(code ? { code } : {}),
    }),
  });
}

export function updateAvailabilityStatus(
  availabilityStatus: "online" | "away" | "brb" | "dnd",
) {
  return apiRequest<User>("/api/auth/availability-status", {
    method: "POST",
    body: JSON.stringify({ availabilityStatus }),
  });
}

export function addProfileImage(file: File) {
  assertAvatarSize(file);
  const form = new FormData();
  form.append("profile-image", file);
  return apiRequest<{ image: string }>("/api/auth/add-profile-image", {
    method: "POST",
    body: form,
  });
}

export function removeProfileImage() {
  return apiRequest<{ message: string }>("/api/auth/remove-profile-image", {
    method: "DELETE",
  });
}

export function addProfileBanner(file: File) {
  assertAvatarSize(file);
  const form = new FormData();
  form.append("profile-banner", file);
  return apiRequest<{ banner: string }>("/api/auth/add-profile-banner", {
    method: "POST",
    body: form,
  });
}

export function removeProfileBanner() {
  return apiRequest<{ message: string }>("/api/auth/remove-profile-banner", {
    method: "DELETE",
  });
}

export function disableAccount(password: string, code?: string) {
  return apiRequest<{ message: string; code: string }>("/api/auth/account/disable", {
    method: "POST",
    body: JSON.stringify({
      password,
      ...(code ? { code } : {}),
    }),
  });
}

export function requestAccountDeletion(password: string, code?: string) {
  return apiRequest<{
    message: string;
    code: string;
    deletionScheduledAt?: string;
    graceDays?: number;
  }>("/api/auth/account/request-deletion", {
    method: "POST",
    body: JSON.stringify({
      password,
      ...(code ? { code } : {}),
    }),
  });
}

export function cancelAccountDeletion(password: string, code?: string) {
  return apiRequest<{
    message: string;
    code: string;
  }>("/api/auth/account/cancel-deletion", {
    method: "POST",
    body: JSON.stringify({
      password,
      ...(code ? { code } : {}),
    }),
  });
}

export interface UserSessionRow {
  id: string;
  label: string;
  browser: string;
  os: string;
  isKnown: boolean;
  isCurrent: boolean;
  createdAt: string | null;
  lastUsedAt: string | null;
}

export function getSessions() {
  return apiRequest<{ sessions: UserSessionRow[] }>("/api/auth/sessions");
}

export function revokeSession(sessionId: string) {
  return apiRequest<{ message: string; currentSessionRevoked?: boolean }>(
    `/api/auth/sessions/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" },
  );
}

export function revokeOtherSessions() {
  return apiRequest<{ message: string; revokedCount: number }>(
    "/api/auth/sessions/revoke-others",
    { method: "POST" },
  );
}
