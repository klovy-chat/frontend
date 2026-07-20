import { apiRequest } from "./client";

export interface ChannelInvite {
  inviteId: string;
  url: string;
  useCount: number;
  maxUses: number | null;
  revoked: boolean;
  createdAt?: string | null;
  expiresAt?: string | null;
}

/**
 * Creates a multi-use invite link for a channel.
 * `maxUses` = null/undefined means unlimited joins; a positive number caps joins.
 */
export function createChannelInvite(channelId: string, maxUses?: number | null) {
  return apiRequest<ChannelInvite>(`/api/channel/${channelId}/invites`, {
    method: "POST",
    body: JSON.stringify({ maxUses: maxUses ?? null }),
  });
}

export function listChannelInvites(channelId: string) {
  return apiRequest<{ invites: ChannelInvite[] }>(
    `/api/channel/${channelId}/invites`,
  );
}

export function deleteChannelInvite(channelId: string, inviteId: string) {
  return apiRequest<{ success: boolean }>(
    `/api/channel/${channelId}/invites/${inviteId}`,
    { method: "DELETE" },
  );
}

export function getChannelInvite(inviteId: string) {
  return apiRequest<{
    invite: {
      inviteId: string;
      channelId: {
        _id: string;
        name: string;
        image?: string;
        description?: string | null;
        memberCount?: number;
        createdAt?: string | null;
      } | null;
      inviter?: {
        displayName?: string | null;
        username: string;
        image?: string | null;
        color?: number | null;
      } | null;
      useCount: number;
      maxUses: number | null;
      revoked: boolean;
      expired: boolean;
      limitReached: boolean;
      joinable: boolean;
      expiresAt?: string | null;
    };
  }>(`/api/invite/${inviteId}`);
}

export function acceptChannelInvite(inviteId: string) {
  return apiRequest<{
    success: boolean;
    channelId: string;
    alreadyMember?: boolean;
  }>(`/api/invite/${inviteId}/accept`, { method: "POST" });
}
