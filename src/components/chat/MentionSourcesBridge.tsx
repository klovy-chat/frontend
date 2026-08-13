import { useEffect } from "react";
import { useWebSocket } from "../../context/WebSocketContext";
import { useAuth } from "../../context/AuthContext";
import { WsType } from "../../api/wsProtocol";
import { addMentionSource } from "../../utils/sync/mentionSources";
import { isConversationMuted } from "../../utils/sync/mutedConversations";
import { isViewingConversation } from "../../utils/sync/activeConversation";

type MentionEvent = {
  scope?: "dm" | "channel";
  sourceId?: string;
};

/**
 * Records @mention dots while ChatPage/Sidebar is unmounted (Settings / Invite),
 * and while Chat is open only when the mentioned conversation is not viewing.
 */
export function MentionSourcesBridge() {
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
