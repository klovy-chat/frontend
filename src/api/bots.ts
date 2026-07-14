import { apiRequest } from "./client";
import type { Bot, InstallableBot } from "../types";

export function listMyBots() {
  return apiRequest<{ bots: Bot[] }>("/api/bots");
}

export function createBot(username: string, displayName: string) {
  return apiRequest<{ bot: Bot }>("/api/bots", {
    method: "POST",
    body: JSON.stringify({ username, displayName }),
  });
}

export function updateBot(
  botId: string,
  patch: { username?: string; displayName?: string; color?: number | null },
) {
  return apiRequest<{ bot: Bot }>(`/api/bots/${botId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export function regenerateBotToken(botId: string) {
  return apiRequest<{ token: string }>(`/api/bots/${botId}/token`, {
    method: "POST",
  });
}

export function deleteBot(botId: string) {
  return apiRequest<{ message: string }>(`/api/bots/${botId}`, {
    method: "DELETE",
  });
}

export function getInstallableBots(channelId: string) {
  return apiRequest<{ bots: InstallableBot[] }>(
    `/api/channel/${channelId}/installable-bots`,
  );
}

export function addBotToChannel(channelId: string, botId: string) {
  return apiRequest<{ message: string; bot: InstallableBot }>(
    `/api/channel/${channelId}/bots`,
    { method: "POST", body: JSON.stringify({ botId }) },
  );
}

export function removeBotFromChannel(channelId: string, botId: string) {
  return apiRequest<{ message: string }>(
    `/api/channel/${channelId}/bots/${botId}`,
    { method: "DELETE" },
  );
}
