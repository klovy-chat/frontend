import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getUserChannels } from "../api/channels";
import { Sidebar } from "../components/sidebar/Sidebar";
import { ChatWindow } from "../components/chat/ChatWindow";
import { WarningModal } from "../components/common/WarningModal";
import { AnnouncementModal } from "../components/common/AnnouncementModal";
import { useWebSocket } from "../context/WebSocketContext";
import { WsType } from "../api/wsProtocol";
import { useProfileSync } from "../hooks/useProfileSync";
import { useListeningSync } from "../hooks/useListeningSync";
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

  useListeningSync(ws, {
    onListening: ({ userId, listeningActivity }) =>
      setActive((prev) =>
        prev?.type === "dm" && prev.contact._id === userId
          ? { ...prev, contact: patchContact(prev.contact, userId, { listeningActivity }) }
          : prev,
      ),
  });

  useEffect(() => {
    if (!ws) return;

    const onUserStatusChanged = (payload: {
      userId: string;
      status: {
        isOnline: boolean;
        lastSeen?: string | number | null;
        availabilityStatus?: "online" | "away" | "brb" | "dnd";
      };
    }) => {
      setActive((prev) => {
        if (prev?.type !== "dm" || prev.contact._id !== payload.userId) return prev;
        return {
          ...prev,
          contact: {
            ...prev.contact,
            isOnline: payload.status.isOnline,
            lastSeen: payload.status.lastSeen
              ? new Date(payload.status.lastSeen).toISOString()
              : prev.contact.lastSeen ?? null,
            availabilityStatus:
              payload.status.availabilityStatus ??
              prev.contact.availabilityStatus ??
              "online",
          },
        };
      });
    };

    const unsub = ws.subscribe(WsType.USER_STATUS_CHANGED, onUserStatusChanged);
    return () => unsub();
  }, [ws]);

  useEffect(() => {
    const openId = (location.state as { openChannelId?: string } | null)?.openChannelId;
    if (!openId) return;
    getUserChannels()
      .then(({ channels }) => {
        const ch = channels.find((c) => c._id === openId);
        if (ch) setActive({ type: "channel", channel: ch });
      })
      .catch(() => { /**/ });
  }, [location.state]);

  return (
    <>
      <Sidebar active={active} onSelect={setActive}>
        <ChatWindow
          target={active}
          onClose={() => setActive(null)}
        />
      </Sidebar>
      <WarningModal />
      <AnnouncementModal />
    </>
  );
}
