import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getUserChannels } from "../api/channels";
import { Sidebar } from "../components/sidebar/Sidebar";
import { ChatWindow } from "../components/chat/ChatWindow";
import { WarningModal } from "../components/common/WarningModal";
import { AnnouncementModal } from "../components/common/AnnouncementModal";
import { useWebSocket } from "../context/WebSocketContext";
import { useProfileSync } from "../hooks/useProfileSync";
import { useListeningSync } from "../hooks/useListeningSync";
import { useIdleAvailability } from "../hooks/useIdleAvailability";
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
  const navigate = useNavigate();
  const ws = useWebSocket();

  useIdleAvailability();

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
    const params = new URLSearchParams(location.search);
    const spotify = params.get("spotify");
    if (spotify === "connected" || spotify === "error") {
      navigate(`/settings/integrations?${params.toString()}`, { replace: true });
    }
  }, [location.search, navigate]);

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
