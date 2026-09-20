import { MessageCircle, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { formatTime, userLabel } from "../../utils/user/format";
import type { Channel, Contact } from "../../types";

interface ConversationHomeProps {
  contacts: Contact[];
  channels: Channel[];
  onSelectContact: (contact: Contact) => void;
  onSelectChannel: (channel: Channel) => void;
}

export function ConversationHome({
  contacts,
  channels,
  onSelectContact,
  onSelectChannel,
}: ConversationHomeProps) {
  const { t } = useTranslation();
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
    <section className="conversation-home">
      <header className="conversation-home__header">
        <div>
          <span className="conversation-home__eyebrow">Klovy Chat</span>
          <h1>{t("chat.home.title")}</h1>
          <p>{t("chat.home.subtitle")}</p>
        </div>
        <MessageCircle size={28} strokeWidth={1.5} aria-hidden="true" />
      </header>

      <div className="conversation-home__stats">
        <div>
          <strong>{unread}</strong>
          <span>{t("chat.home.unread")}</span>
        </div>
        <div>
          <strong>{contacts.length}</strong>
          <span>{t("chat.home.contacts")}</span>
        </div>
        <div>
          <strong>{channels.length}</strong>
          <span>{t("chat.home.channels")}</span>
        </div>
      </div>

      <div className="conversation-home__section">
        <div className="conversation-home__section-head">
          <h2>{t("chat.home.recent")}</h2>
          <Users size={16} aria-hidden="true" />
        </div>
        {recent.length === 0 ? (
          <p className="conversation-home__empty">{t("chat.home.noRecent")}</p>
        ) : (
          <div className="conversation-home__recent">
            {recent.map((item) => {
              const isChannel = "name" in item && "members" in item;
              const label = isChannel ? item.name : userLabel(item);
              return (
                <button
                  key={item._id}
                  type="button"
                  className="conversation-home__row"
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
                  <span className="conversation-home__row-copy">
                    <strong>{label}</strong>
                    <span>{item.lastMessage || t("chat.home.noMessages")}</span>
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
