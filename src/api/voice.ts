import { apiRequest } from "./client";

export interface VoiceTokenResponse {
  token: string;
  url: string;
  room: string;
}

/** Pobiera token dostępu LiveKit dla rozmowy 1:1 z danym kontaktem. */
export function requestVoiceToken(peerId: string) {
  return apiRequest<VoiceTokenResponse>("/api/voice/token", {
    method: "POST",
    body: JSON.stringify({ peerId }),
  });
}
