import { Hash, MessageCircle, Phone, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { formatTime, userLabel } from "../../utils/user/format";
import { formatListLastMessage } from "../../utils/chat/messages";
import { useCallCount } from "../../hooks/useCallCount";
import "../../styles/nav/home.css";
import type { Channel, Contact } from "../../types";

interface ConversationHomeProps {
  contacts: Contact[];
  channels: Channel[];
  onSelectContact: (contact: Contact) => void;
  onSelectChannel: (channel: Channel) => void;
  onOpenChats: () => void;
  onOpenCalls: () => void;
  onOpenContacts: () => void;
  onOpenChannels: () => void;
}

export function ConversationHome({
  contacts,
  channels,
  onSelectContact,
  onSelectChannel,
  onOpenChats,
  onOpenCalls,
  onOpenContacts,
  onOpenChannels,
}: ConversationHomeProps) {
  const { t } = useTranslation();
  const callCount = useCallCount(contacts, channels);
  const unread = [...contacts, ...channels].reduce(
    (sum, item) => sum + Math.max(0, item.unreadCount ?? 0),
    0,
  );
  const recent = [...contacts, ...channels]
    .filter((item) => item.lastMessageTime)
    .sort(
      (a, b) =>
        new Date(b.lastMessageTime ?? 0).getTime() -
        new Date(a.lastMessageTime ?? 0).getTime(),
    )
    .slice(0, 5);

  return (
    <section className="workspace-home">
      <header className="workspace-home__header">
        <div>
          <h1>{t("nav.items.home")}</h1>
          <p>{t("chat.home.subtitle")}</p>
        </div>
        <MessageCircle size={28} strokeWidth={1.5} aria-hidden="true" />
      </header>

      <div className="workspace-home__stats">
        <button type="button" onClick={onOpenChats}>
          <MessageCircle size={18} aria-hidden="true" />
          <strong>{unread}</strong>
          <span>{t("chat.home.unread")}</span>
        </button>
        <button type="button" onClick={onOpenCalls}>
          <Phone size={18} aria-hidden="true" />
          <strong>{callCount ?? "…"}</strong>
          <span>{t("chat.home.conversations")}</span>
        </button>
        <button type="button" onClick={onOpenContacts}>
          <Users size={18} aria-hidden="true" />
          <strong>{t("nav.items.contacts")}</strong>
          <span>{t("chat.home.openList")}</span>
        </button>
        <button type="button" onClick={onOpenChannels}>
          <Hash size={18} aria-hidden="true" />
          <strong>{t("chat.home.channelsTitle")}</strong>
          <span>{t("chat.home.openList")}</span>
        </button>
      </div>

      <div className="workspace-home__section">
        <div className="workspace-home__section-head">
          <h2>{t("chat.home.recent")}</h2>
          <Users size={16} aria-hidden="true" />
        </div>
        {recent.length === 0 ? (
          <p className="workspace-home__empty">{t("chat.home.noRecent")}</p>
        ) : (
          <div className="workspace-home__recent">
            {recent.map((item) => {
              const isChannel = "name" in item && "members" in item;
              const label = isChannel ? item.name : userLabel(item);
              return (
                <button
                  key={`${isChannel ? "channel" : "dm"}:${item._id}`}
                  type="button"
                  className="workspace-home__row"
                  onClick={() => {
                    if (isChannel) onSelectChannel(item as Channel);
                    else onSelectContact(item as Contact);
                  }}
                >
                  <Avatar
                    displayName={isChannel ? item.name : item.displayName}
                    username={isChannel ? undefined : item.username}
                    image={item.image}
                    color={isChannel ? undefined : item.color}
                    placeholder={isChannel ? "#" : undefined}
                    size={40}
                  />
                  <span className="workspace-home__row-copy">
                    <strong>{label}</strong>
                    <span>{item.lastMessage ? formatListLastMessage(item.lastMessage) : t("chat.home.noMessages")}</span>
                  </span>
                  {item.lastMessageTime && (
                    <time dateTime={item.lastMessageTime}>{formatTime(item.lastMessageTime)}</time>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
