// Mentions.tsx
// Trzyma listę @kandydatów przy Chat↔Settings.
// Zakres:
//  - ids w sync/mentions.ts
//  - trzyma ids @kandydatów przy Chat↔Settings
// Nowe źródło wzmianek (np. członkowie kanału): tu + MessageInput caret.
// Przy zmianach: mentions.ts, MessageInput.tsx.

import { useEffect } from "react";
import { useWebSocket } from "../../context/WebSocketContext";
import { useAuth } from "../../context/AuthContext";
import { WsType } from "../../api/protocol";
import { addMentionSource } from "../../utils/sync/mentions";
import { isConversationMuted } from "../../utils/sync/muted";
import { isViewingConversation } from "../../utils/sync/activeChat";

type MentionEvent = {
  scope?: "dm" | "channel";
  sourceId?: string;
};

export function Mentions() {
  const ws = useWebSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (!ws) return;
    const onMention = (payload: MentionEvent) => {
      if (!payload?.sourceId || !payload.scope) return;
      if (user?.availabilityStatus === "dnd") return;
      if (isConversationMuted(payload.scope, payload.sourceId)) return;
      if (isViewingConversation(payload.scope, payload.sourceId)) return;
      addMentionSource(payload.sourceId);
    };
    return ws.subscribe(WsType.MESSAGE_MENTION, onMention);
  }, [ws, user?.availabilityStatus]);

  return null;
}
