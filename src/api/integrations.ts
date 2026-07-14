import { apiRequest } from "./client";
import type { ListeningActivity } from "../types";

export interface SpotifyStatus {
  connected: boolean;
  shareListening: boolean;
  enabled: boolean;
}

export interface SpotifySyncResult {
  listeningActivity: ListeningActivity | null;
  shareListening: boolean;
  applied?: boolean;
}

export function getSpotifyStatus(): Promise<SpotifyStatus> {
  return apiRequest<SpotifyStatus>("/api/integrations/spotify/status");
}

function getSpotifyConnectUrl(): Promise<{ url: string }> {
  const returnTo = encodeURIComponent(window.location.origin);
  return apiRequest<{ url: string }>(
    `/api/integrations/spotify/connect-url?returnTo=${returnTo}`,
  );
}

export async function connectSpotify(): Promise<void> {
  const { url } = await getSpotifyConnectUrl();
  window.location.assign(url);
}

export function disconnectSpotify(): Promise<{ success: boolean; connected: boolean }> {
  return apiRequest("/api/integrations/spotify/disconnect", { method: "DELETE" });
}

export function syncSpotifyListening(payload: {
  clientType: "web" | "desktop";
  clientInstanceId: string;
}): Promise<SpotifySyncResult> {
  return apiRequest<SpotifySyncResult>("/api/integrations/spotify/sync", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateShareListening(
  shareListening: boolean,
): Promise<{ success: boolean; shareListening: boolean }> {
  return apiRequest("/api/integrations/listening/settings", {
    method: "PATCH",
    body: JSON.stringify({ shareListening }),
  });
}
