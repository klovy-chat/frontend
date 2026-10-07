import { useCall } from "../../context/CallContext";
import { useState } from "react";
import { OtherProfile } from "../profile/OtherProfile";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { userLabel, formatLastSeen } from "../../utils/user/format";
import { useUserPresence } from "../../context/PresenceContext";
import { useSyncExternalStore } from "react";
import { subscribeMutedConversations, getMutedConversationKeys } from "../../utils/sync/muted";
import type { ChatTarget } from "../../types";
import { ConversationMedia } from "./ConversationMedia";

interface ConversationDetailsProps {
  target: ChatTarget | null;
}

export function ConversationDetails({ target }: ConversationDetailsProps) {
  const { t } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);
  const { startCall, state: callState } = useCall();
  const presence = useUserPresence(target?.type === "dm" ? target.contact._id : undefined);
  const mutedKey = target ? `${target.type}:${target.type === "dm" ? target.contact._id : target.channel._id}` : "";
  const muted = useSyncExternalStore(subscribeMutedConversations, () => getMutedConversationKeys().includes(mutedKey));

  if (!target) {
    return (
      <aside className="conversation-details conversation-details--empty">
        <span className="conversation-details__empty-mark">+</span>
        <p>{t("chat.empty.selectChat")}</p>
      </aside>
    );
  }

  const isDm = target.type === "dm";
  const online = isDm && (presence?.isOnline ?? target.contact.isOnline);
  const title = isDm ? userLabel(target.contact) : target.channel.name;
  const description = isDm
    ? target.contact.bio || t("chat.details.noBio")
    : target.channel.description || t("chat.details.noDescription");
  const memberCount = isDm ? null : target.channel.memberCount ?? target.channel.members.length;

  return (
    <aside className="conversation-details">
      <div className="conversation-details__cover" />
      <div className="conversation-details__identity">
        <button type="button" className="conversation-details__avatar-button" disabled={!isDm} onClick={() => setProfileOpen(true)} aria-label={t("chat.window.contactProfile")}>
        <Avatar
          displayName={isDm ? target.contact.displayName : target.channel.name}
          username={isDm ? target.contact.username : undefined}
          image={isDm ? target.contact.image : target.channel.image}
          color={isDm ? target.contact.color : undefined}
          placeholder={isDm ? undefined : "#"}
          size={80}
        />
        </button>
        <button type="button" className="conversation-details__name-button" disabled={!isDm} onClick={() => setProfileOpen(true)}><h2>{title}</h2></button>
        {isDm && <span className={online ? "conversation-details__online" : ""}>{t(online ? "user.availability.online" : "user.availability.offline")}</span>}
        {!isDm && memberCount !== null && (
          <span>
            {memberCount} {t("chat.details.members")}
          </span>
        )}
      </div>

      <div className="conversation-details__section">
        <h3>{isDm ? t("chat.details.about") : t("chat.details.description")}</h3>
        <p>{description}</p>
      </div>

      <div className="conversation-details__section">
        <h3>{t("chat.details.quickInfo")}</h3>
        <div className="conversation-details__facts">
          <div>
            <span>{t("chat.details.type")}</span>
            <strong>{isDm ? t("chat.details.direct") : t("chat.details.channel")}</strong>
          </div>
          {isDm && <div><span>{t("chat.details.lastActivity", { defaultValue: "Last activity" })}</span><strong>{formatLastSeen(presence?.lastSeen ?? target.contact.lastSeen, { isOnline: !!online })}</strong></div>}
          <div><span>{t("chat.details.notifications", { defaultValue: "Notifications" })}</span><strong>{t(muted ? "chat.notifications.mute" : "chat.details.enabled", { defaultValue: muted ? "Muted" : "Enabled" })}</strong></div>
          {isDm && target.contact.username && <div><span>{t("chat.details.username", { defaultValue: "User" })}</span><strong>@{target.contact.username}</strong></div>}
          {!isDm && (
            <div>
              <span>{t("chat.details.admin")}</span>
              <strong>{userLabel(target.channel.admin)}</strong>
            </div>
          )}
        </div>
      </div>
      <ConversationMedia key={mutedKey} target={target} />
      {isDm && <OtherProfile variant="sheet" isOpen={profileOpen} onClose={() => setProfileOpen(false)} user={target.contact} isFriend={false} canCall={callState === "idle"} onCall={kind => { if (callState === "idle") startCall({ _id: target.contact._id, username: target.contact.username, displayName: target.contact.displayName, image: target.contact.image, color: target.contact.color }, kind); }} />}
    </aside>
  );
}
