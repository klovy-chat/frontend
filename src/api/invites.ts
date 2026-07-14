import { apiRequest } from "./client";

export function createChannelInvite(channelId: string) {
  return apiRequest<{ inviteId: string; url: string }>(
    `/api/channel/${channelId}/invite-link`,
    { method: "POST" },
  );
}

export function getChannelInvite(inviteId: string) {
  return apiRequest<{
    invite: {
      inviteId: string;
      used: boolean;
      channelId: { _id: string; name: string; image?: string } | null;
      inviter?: {
        displayName?: string | null;
        username: string;
        image?: string | null;
        color?: number | null;
      } | null;
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
