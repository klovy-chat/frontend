import { Globe2, Phone, Radio } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { useCall } from "../../context/CallContext";
import { userLabel } from "../../utils/user/format";
import type { Channel } from "../../types";

interface WorkspaceDirectoryProps {
  mode: "communities" | "calls";
  channels: Channel[];
  onSelectChannel: (channel: Channel) => void;
}

export function WorkspaceDirectory({ mode, channels, onSelectChannel }: WorkspaceDirectoryProps) {
  const { t } = useTranslation();
  const call = useCall();

  if (mode === "calls") {
    const targetName = call.callKind === "channel"
      ? call.channel?.name
      : call.peer
        ? userLabel(call.peer)
        : null;
    const isActive = call.state !== "idle";

    return (
      <section className="workspace-directory">
        <header className="workspace-directory__header">
          <div>
            <span className="workspace-directory__eyebrow">Klovy Chat</span>
            <h1>{t("chat.calls.title")}</h1>
            <p>{t("chat.calls.subtitle")}</p>
          </div>
          <Phone size={28} strokeWidth={1.5} aria-hidden="true" />
        </header>
        <div className={`workspace-directory__call-state${isActive ? " is-active" : ""}`}>
          <span className="workspace-directory__call-icon">
            <Radio size={20} />
          </span>
          <div>
            <strong>{isActive ? t("chat.calls.active") : t("chat.calls.ready")}</strong>
            <p>{targetName || t("chat.calls.openChat")}</p>
          </div>
        </div>
        <p className="workspace-directory__note">{t("chat.calls.note")}</p>
      </section>
    );
  }

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
