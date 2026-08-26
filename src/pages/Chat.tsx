// Chat.tsx
// Shell czatu: Nav, lista/sidebar, okno rozmowy albo Contacts.
// Zakres:
//  - ustawia activeChat i chatMounted dla unread/mark-read
//  - Nav + lista + okno albo Contacts; ustawia activeChat
// UnreadSync zostaje w App — nie montuj go tylko tutaj, zginie w Settings.
// Przy zmianach: Sidebar.tsx, ChatWindow.tsx, sync/activeChat.ts.

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getUserChannels } from "../api/channels";
import { Sidebar } from "../components/sidebar/Sidebar";
import { ChatWindow } from "../components/chat/ChatWindow";
import { useWebSocket } from "../context/WebSocketContext";
import { useProfileSync } from "../hooks/useProfileSync";
import { setActiveConversationKey } from "../utils/sync/activeChat";
import { markChatMounted } from "../utils/sync/chatMounted";
import { isConversationMuted } from "../utils/sync/muted";
import type { ChatTarget, Contact } from "../types";
import "../styles/chat/chat.css";

function patchContact(
  contact: Contact,
  userId: string,
  patch: Partial<Contact>,
): Contact {
  return contact._id === userId ? { ...contact, ...patch } : contact;
}

export function Chat() {
  const [active, setActive] = useState<ChatTarget | null>(null);
  const location = useLocation();
  const ws = useWebSocket();

  useEffect(() => markChatMounted(), []);

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

              unreadCount: 0,
            },
          });
        }
      })
      .catch(() => {/**/});
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
