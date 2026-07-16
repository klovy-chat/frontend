import { apiRequest, withTransientRetry } from "./client";
import { assertAvatarSize } from "../constants/upload";
import type { Channel, ChannelDetails, Message } from "../types";

export function getUserChannels() {
  return apiRequest<{ channels: Channel[] }>("/api/channel/get-user-channels");
}

export function getChannelMessages(
  channelId: string,
  opts?: { before?: string; limit?: number },
) {
  const params = new URLSearchParams();
  if (opts?.before) params.set("before", opts.before);
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  return apiRequest<{ messages: Message[]; hasMore?: boolean }>(
    `/api/channel/get-channel-messages/${channelId}${qs ? `?${qs}` : ""}`,
  );
}

export function createChannel(name: string, members: string[] = []) {
  return apiRequest<{ channel: Channel }>("/api/channel/create-channel", {
    method: "POST",
    body: JSON.stringify({ name, members }),
  });
}

export function renameChannel(channelId: string, name: string) {
  return apiRequest<{ name: string }>(`/api/channel/${channelId}/name`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function updateChannelSlowmode(channelId: string, rateLimitPerUser: number) {
  return apiRequest<{ rateLimitPerUser: number }>(`/api/channel/${channelId}/slowmode`, {
    method: "PATCH",
    body: JSON.stringify({ rateLimitPerUser }),
  });
}

export function updateChannelChatLock(channelId: string, chatLocked: boolean) {
  return apiRequest<{ chatLocked: boolean }>(`/api/channel/${channelId}/chat-lock`, {
    method: "PATCH",
    body: JSON.stringify({ chatLocked }),
  });
}

export function uploadChannelAvatar(channelId: string, file: File) {
  assertAvatarSize(file);
  const form = new FormData();
  form.append("avatar", file);
  return withTransientRetry(() =>
    apiRequest<{ message: string; image: string }>(
      `/api/channel/${channelId}/avatar`,
      {
        method: "POST",
        body: form,
      },
    ),
  );
}

export function removeChannelAvatar(channelId: string) {
  return apiRequest<{ message: string }>(
    `/api/channel/${channelId}/avatar`,
    {
      method: "DELETE",
    },
  );
}

export function deleteChannel(channelId: string) {
  return apiRequest<{ message: string }>(`/api/channel/delete/${channelId}`, {
    method: "DELETE",
  });
}
export function leaveChannel(channelId: string) {
  return apiRequest<void>(`/api/channel/leave/${channelId}`, {
    method: "POST",
  });
}

export function getChannelDetails(channelId: string) {
  return apiRequest<{ channel: ChannelDetails }>(
    `/api/channel/${channelId}/details`,
  );
}

export function toggleChannelMute(channelId: string) {
  return apiRequest<{ isMuted: boolean; message: string }>(
    `/api/channel/${channelId}/mute`,
    { method: "POST" },
  );
}

export function reportChannel(
  channelId: string,
  payload: { reason: string; details?: string },
) {
  return apiRequest<{ message: string }>(
    `/api/channel/${channelId}/report`,
    { method: "POST", body: JSON.stringify(payload) },
  );
}

interface ChannelModerationLists {
  bannedMembers: ChannelDetails["bannedMembers"];
  mutedMembers: ChannelDetails["mutedMembers"];
}

export type ChannelModerationResponse = {
  message: string;
} & Partial<ChannelModerationLists>;

export function kickChannelMember(channelId: string, userId: string) {
  return apiRequest<{ message: string }>(`/api/channel/${channelId}/kick`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function banChannelMember(
  channelId: string,
  userId: string,
  durationSeconds?: number,
) {
  return apiRequest<ChannelModerationResponse>(`/api/channel/${channelId}/ban`, {
    method: "POST",
    body: JSON.stringify({
      userId,
      ...(durationSeconds != null ? { durationSeconds } : {}),
    }),
  });
}

export function unbanChannelMember(channelId: string, userId: string) {
  return apiRequest<ChannelModerationResponse>(`/api/channel/${channelId}/unban`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function muteChannelMember(
  channelId: string,
  userId: string,
  durationSeconds?: number,
) {
  return apiRequest<ChannelModerationResponse>(
    `/api/channel/${channelId}/mute-member`,
    {
      method: "POST",
      body: JSON.stringify({
        userId,
        ...(durationSeconds != null ? { durationSeconds } : {}),
      }),
    },
  );
}

export function unmuteChannelMember(channelId: string, userId: string) {
  return apiRequest<ChannelModerationResponse>(
    `/api/channel/${channelId}/unmute-member`,
    { method: "POST", body: JSON.stringify({ userId }) },
  );
}

