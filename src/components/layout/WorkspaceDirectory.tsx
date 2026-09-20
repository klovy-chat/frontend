import { Globe2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import type { Channel } from "../../types";

interface WorkspaceDirectoryProps {
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
}

export function WorkspaceDirectory({ channels, onSelectChannel }: WorkspaceDirectoryProps) {
  const { t } = useTranslation();

  return (
    <section className="workspace-directory">
      <header className="workspace-directory__header">
        <div>
          <span className="workspace-directory__eyebrow">Klovy Chat</span>
          <h1>{t("chat.communities.title")}</h1>
          <p>{t("chat.communities.subtitle")}</p>
        </div>
        <Globe2 size={28} strokeWidth={1.5} aria-hidden="true" />
      </header>
      {channels.length === 0 ? (
        <p className="workspace-directory__empty">{t("chat.communities.empty")}</p>
      ) : (
        <div className="workspace-directory__channels">
          {channels.map((channel) => (
            <button
              type="button"
              className="workspace-directory__channel"
              key={channel._id}
              onClick={() => onSelectChannel(channel)}
            >
              <Avatar displayName={channel.name} image={channel.image} placeholder="#" size={42} />
              <span>
                <strong>#{channel.name}</strong>
                <small>{channel.description || t("chat.communities.noDescription")}</small>
              </span>
              <em>{channel.memberCount ?? channel.members.length}</em>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
