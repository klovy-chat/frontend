import { apiRequest } from "./client";

export type PresenceVisibility = "everyone" | "friends" | "nobody";

export interface PresenceSettings {
  presenceVisibility: PresenceVisibility;
  presenceVisibleTo: string[];
  presenceHiddenUntil: string | null;
}

export function getPresenceSettings() {
  return apiRequest<PresenceSettings>("/api/users/presence-settings");
}

export function updatePresenceSettings(settings: PresenceSettings) {
  return apiRequest<PresenceSettings>("/api/users/presence-settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}
