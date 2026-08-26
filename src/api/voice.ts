// voice.ts
// HTTP tokenów LiveKit; signaling dzwonienia jest na WS.
// Zakres:
//  - DM call i voice kanału
//  - token LiveKit; dzwonek/hangup idzie ramkami CALL_*
// Nowy stan rozmowy: CallContext + CALL_* w handlers.rs.
// Przy zmianach: CallContext.tsx, utils/voice/*.rs.

import { apiRequest } from "./client";

export interface VoiceTokenResponse {
  token: string;
  url: string;
  room: string;
}

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

export function fetchActiveCall() {
  return apiRequest<ActiveCallResponse>("/api/voice/active");
}
