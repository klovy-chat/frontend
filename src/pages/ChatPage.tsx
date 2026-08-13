import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getUserChannels } from "../api/channels";
import { Sidebar } from "../components/sidebar/Sidebar";
import { ChatWindow } from "../components/chat/ChatWindow";
import { useWebSocket } from "../context/WebSocketContext";
import { useProfileSync } from "../hooks/useProfileSync";
import { setActiveConversationKey } from "../utils/sync/activeConversation";
import { markChatPageMounted } from "../utils/sync/chatPageMounted";
import { isConversationMuted } from "../utils/sync/mutedConversations";
import type { ChatTarget, Contact } from "../types";
import "../styles/chat/chat.css";

function patchContact(
  contact: Contact,
  userId: string,
  patch: Partial<Contact>,
): Contact {
  return contact._id === userId ? { ...contact, ...patch } : contact;
}

export function ChatPage() {
  const [active, setActive] = useState<ChatTarget | null>(null);
  const location = useLocation();
  const ws = useWebSocket();

  useEffect(() => markChatPageMounted(), []);

  // Set key synchronously on change — never null the active key on switch
  // (cleanup→null→set gap made MentionSources/UnreadBadge see "not viewing").
  useEffect(() => {
    if (!active) {
      setActiveConversationKey(null);
      return;
    }
    setActiveConversationKey(
      active.type === "dm"
        ? `dm:${active.contact._id}`
        : `channel:${active.channel._id}`,
    );
  }, [active]);

  useEffect(() => () => setActiveConversationKey(null), []);

  useProfileSync(ws, {
    onInfo: ({ userId, username, displayName, bio, color }) =>
      setActive((prev) =>
        prev?.type === "dm" && prev.contact._id === userId
          ? {
              ...prev,
              contact: patchContact(prev.contact, userId, {
                username: username ?? prev.contact.username,
                displayName: displayName ?? prev.contact.displayName,
                bio: bio ?? prev.contact.bio,
                color: color ?? prev.contact.color,
              }),
            }
          : prev,
      ),
    onImage: ({ userId, image }) =>
      setActive((prev) =>
        prev?.type === "dm" && prev.contact._id === userId
          ? { ...prev, contact: patchContact(prev.contact, userId, { image }) }
          : prev,
      ),
    onBanner: ({ userId, banner }) =>
      setActive((prev) =>
        prev?.type === "dm" && prev.contact._id === userId
          ? { ...prev, contact: patchContact(prev.contact, userId, { banner }) }
          : prev,
      ),
  });

  useEffect(() => {
    const openId = (location.state as { openChannelId?: string } | null)?.openChannelId;
    if (!openId) return;
    getUserChannels()
      .then(({ channels }) => {
        const ch = channels.find((c) => c._id === openId);
        if (ch) {
          setActive({
            type: "channel",
            channel: {
              ...ch,
              isMuted: isConversationMuted("channel", ch._id),
              // Viewing-zero — nav totalUnread sums roster; title excludes active.
              unreadCount: 0,
            },
          });
        }
      })
      .catch(() => { /**/ });
  }, [location.state]);

  return (
    <Sidebar active={active} onSelect={setActive}>
      <ChatWindow
        target={active}
        onClose={() => setActive(null)}
      />
    </Sidebar>
  );
}
