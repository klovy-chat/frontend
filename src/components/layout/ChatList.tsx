// ChatList.tsx
// Wiersze listy DM/kanałów (taby, preview, badge, szukajka).
// Zakres:
//  - prezentacja stanu z Sidebara, mało logiki sync
//  - wiersze z danymi Sidebara: preview, badge, taby
// Nowe pole w wierszu: dane z Sidebara/Contact, styl list.css.
// Przy zmianach: Sidebar.tsx, styles/chat/list.css.

﻿import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { UnreadBadge } from "../common/UnreadBadge";
import { userLabel, formatTime } from "../../utils/user/format";
import { formatListLastMessage } from "../../utils/chat/messages";
import {
  getEffectiveStatus,
  PRESENCE_COLORS,
} from "../../utils/user/presence";
import { useUserPresence } from "../../context/PresenceContext";
import type { Channel, ChatTarget, Contact } from "../../types";
import "../../styles/chat/list.css";

export type ChatListTab = "dm" | "channels";

interface ChatListProps {
  contacts: Contact[];
  channels: Channel[];
  active: ChatTarget | null;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  searchResults: Contact[];
  activeTab: ChatListTab;
  onTabChange: (tab: ChatListTab) => void;
  mentionSources: Set<string>;
  onSelectContact: (contact: Contact) => void;
  onSelectChannel: (channel: Channel) => void;
  onContactContextMenu: (e: React.MouseEvent, contact: Contact) => void;
  onChannelContextMenu: (e: React.MouseEvent, channel: Channel) => void;
  onNewChannel: () => void;
}

function ContactRow({
  c,
  active,
  mentionSources,
  onSelectContact,
  onContactContextMenu,
}: {
  c: Contact;
  active: boolean;
  mentionSources: Set<string>;
  onSelectContact: (contact: Contact) => void;
  onContactContextMenu: (e: React.MouseEvent, contact: Contact) => void;
}) {
  const { t } = useTranslation();
  const live = useUserPresence(c._id);
  const status = getEffectiveStatus({ ...c, ...(live ?? {}) });
  const muted = !!c.isMuted;
  const unread = active ? 0 : (c.unreadCount ?? 0);

  return (
    <div
      role="button"
      tabIndex={0}
      className={`chat-list-item${active ? " active" : ""}${!muted && unread > 0 ? " has-unread" : ""}${muted ? " is-muted" : ""}`}
      onClick={() => onSelectContact(c)}
      onContextMenu={(e) => onContactContextMenu(e, c)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectContact(c);
        }
      }}
    >
      <div style={{ position: "relative", display: "inline-flex" }}>
        <Avatar
          displayName={c.displayName}
          username={c.username}
          image={c.image}
          color={c.color}
        />
        <span
          className="presence-dot"
          style={{ background: PRESENCE_COLORS[status] }}
        />
      </div>
      <div className="chat-list-item__inner">
        <span className="chat-list-item__name">{userLabel(c)}</span>
        {c.lastMessage && (
          <span className="chat-list-item__preview">
            {formatListLastMessage(c.lastMessage)}
          </span>
        )}
      </div>
      {(c.lastMessageTime || muted || unread > 0 || (!active && mentionSources.has(c._id))) && (
        <div className="chat-list-item__meta">
          {c.lastMessageTime && (
            <span className="chat-list-item__time">{formatTime(c.lastMessageTime)}</span>
          )}
          {muted ? (
            <span className="chat-list-item__mute-icon" title={t("chat.list.muted")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="1" y1="1" x2="23" y2="23" />
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
              </svg>
            </span>
          ) : (
            <>
              {!active && mentionSources.has(c._id) && (
                <span className="chat-list-item__mention" title={t("chat.list.mention")}>@</span>
              )}
              <UnreadBadge count={unread} />
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function ChatList({
  contacts,
  channels,
  active,
  searchTerm,
  onSearchChange,
  searchResults,
  activeTab,
  onTabChange,
  mentionSources,
  onSelectContact,
  onSelectChannel,
  onContactContextMenu,
  onChannelContextMenu,
  onNewChannel,
}: ChatListProps) {
  const { t } = useTranslation();
  const isActiveDm = (id: string) => active?.type === "dm" && active.contact._id === id;
  const isActiveChannel = (id: string) => active?.type === "channel" && active.channel._id === id;

  const filteredContacts = activeTab === "channels" ? [] : contacts;
  const filteredChannels = activeTab === "dm" ? [] : channels;
  const showSearch = searchTerm.trim().length > 0;

  const renderContact = (c: Contact) => (
    <ContactRow
      key={c._id}
      c={c}
      active={isActiveDm(c._id)}
      mentionSources={mentionSources}
      onSelectContact={onSelectContact}
      onContactContextMenu={onContactContextMenu}
    />
  );

  const renderChannel = (ch: Channel) => {
    const a = isActiveChannel(ch._id);
    const muted = !!ch.isMuted;
    const unread = a ? 0 : (ch.unreadCount ?? 0);
    return (
      <button
        key={ch._id}
        type="button"
        className={`chat-list-item${a ? " active" : ""}${!muted && unread > 0 ? " has-unread" : ""}${muted ? " is-muted" : ""}`}
        onClick={() => onSelectChannel(ch)}
        onContextMenu={(e) => onChannelContextMenu(e, ch)}
      >
        <Avatar displayName={ch.name} image={ch.image} placeholder="#" />
        <div className="chat-list-item__inner">
          <span className="chat-list-item__name">{ch.name}</span>
          {(ch.lastMessage || ch.description) && (
            <span className="chat-list-item__preview">
              {ch.lastMessage ? formatListLastMessage(ch.lastMessage) : ch.description}
            </span>
          )}
        </div>
        {(ch.lastMessageTime || muted || unread > 0 || (!a && mentionSources.has(ch._id))) && (
          <div className="chat-list-item__meta">
            {ch.lastMessageTime && (
              <span className="chat-list-item__time">{formatTime(ch.lastMessageTime)}</span>
            )}
            {muted ? (
              <span className="chat-list-item__mute-icon" title={t("chat.list.muted")}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" />
                </svg>
              </span>
            ) : (
              <>
                {!a && mentionSources.has(ch._id) && (
                  <span className="chat-list-item__mention" title={t("chat.list.mention")}>@</span>
                )}
                <UnreadBadge count={unread} />
              </>
            )}
          </div>
        )}
      </button>
    );
  };

  const tabLabels: Record<ChatListTab, string> = {
    dm: t("chat.list.tabs.dm"),
    channels: t("chat.list.tabs.channels"),
  };

  return (
    <div className="chat-list-pane">
      <div className="chat-list-pane__header">
        <h2 className="chat-list-pane__title">{t("chat.list.title")}</h2>
        <button type="button" className="chat-list-pane__add-btn" title={t("chat.list.newChannel")} onClick={onNewChannel}>
          +
        </button>
      </div>

      <div className="chat-list-pane__search">
        <div className="chat-list-pane__search-wrap">
          <span className="chat-list-pane__search-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            className="chat-list-pane__search-input"
            placeholder={t("chat.list.searchPlaceholder")}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {!showSearch && (
        <div className="chat-list-pane__tabs">
          {([
            ["dm", contacts.length],
            ["channels", channels.length],
          ] as const).map(([key, count]) => (
            <button
              key={key}
              type="button"
              className={`chat-list-pane__tab${activeTab === key ? " active" : ""}`}
              onClick={() => onTabChange(key)}
            >
              {tabLabels[key]}
              {count > 0 && <span className="chat-list-pane__tab-count">{count}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="chat-list-pane__scroll">
        {showSearch ? (
          searchResults.length === 0 ? (
            <p className="chat-list-pane__empty">{t("chat.list.searchEmpty")}</p>
          ) : (
            searchResults.map(renderContact)
          )
        ) : (
          <>
            {filteredContacts.length === 0 && filteredChannels.length === 0 ? (
              <p className="chat-list-pane__empty">
                {activeTab === "dm" ? t("chat.list.emptyDm") : t("chat.list.emptyChannels")}
              </p>
            ) : (
              <>
                {filteredContacts.map(renderContact)}
                {filteredChannels.map(renderChannel)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
