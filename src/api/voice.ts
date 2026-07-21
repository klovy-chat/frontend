import { apiRequest } from "./client";

export interface VoiceTokenResponse {
  token: string;
  url: string;
  room: string;
}

/** Pobiera token dostępu LiveKit dla rozmowy 1:1 lub kanału głosowego. */
export function requestVoiceToken(params: { peerId?: string; channelId?: string }) {
  return apiRequest<VoiceTokenResponse>("/api/voice/token", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export interface ActiveCallResponse {
  active: boolean;
  peerId?: string;
  mode?: "audio" | "video";
}

/** Sprawdza, czy użytkownik ma aktywną sesję rozmowy po stronie serwera. */
export function fetchActiveCall() {
  return apiRequest<ActiveCallResponse>("/api/voice/active");
}
