import { useCall } from "../../context/CallContext";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { OtherProfile } from "../profile/OtherProfile";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { userLabel, formatLastSeen } from "../../utils/user/format";
import { useUserPresence } from "../../context/PresenceContext";
import { useSyncExternalStore } from "react";
import { subscribeMutedConversations, getMutedConversationKeys } from "../../utils/sync/muted";
import type { ChatTarget, ChannelDetails, Contact } from "../../types";
import { getChannelDetails } from "../../api/channels";
import { ConversationMedia } from "./ConversationMedia";
import { useProfileBannerStyle } from "../../hooks/useMediaCache";
import { LoadingSkeleton } from "../common/LoadingSkeleton";
import { mapChannelUser, mapChannelUserList } from "../../utils/chat/member";

interface ConversationDetailsProps {
  target: ChatTarget | null;
  onClose?: () => void;
  onOpenChannelInfo?: () => void;
}

function ChannelMember({ member, isAdmin, onOpen }: { member: Contact; isAdmin: boolean; onOpen: () => void }) {
  const { t } = useTranslation();
  const presence = useUserPresence(member._id);
  const online = presence?.isOnline ?? member.isOnline;
  return <button type="button" className="conversation-details__member" onClick={onOpen}>
    <Avatar displayName={member.displayName} username={member.username} image={member.image} color={member.color} size={36} />
    <span><strong>{userLabel(member)}</strong><small className={online ? "conversation-details__online" : ""}>{formatLastSeen(presence?.lastSeen ?? member.lastSeen, { isOnline: online })}</small></span>
    {isAdmin && <em>{t("chat.details.admin")}</em>}
  </button>;
}

export function ConversationDetails({ target, onClose, onOpenChannelInfo }: ConversationDetailsProps) {
  const { t } = useTranslation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Contact | null>(null);
  const [channelDetails, setChannelDetails] = useState<ChannelDetails | null>(null);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState(false);
  const [visibleMembers, setVisibleMembers] = useState(5);
  const channelId = target?.type === "channel" ? target.channel._id : null;
  useEffect(() => {
    setChannelDetails(null);
    setMembersError(false);
    setVisibleMembers(5);
    if (!channelId) { setMembersLoading(false); return; }
    let cancelled = false;
    setMembersLoading(true);
    void getChannelDetails(channelId).then(({ channel }) => {
      if (!cancelled) setChannelDetails({ ...channel, admin: mapChannelUser(channel.admin) ?? channel.admin, members: mapChannelUserList(channel.members) });
    }).catch(() => { if (!cancelled) setMembersError(true); }).finally(() => { if (!cancelled) setMembersLoading(false); });
    return () => { cancelled = true; };
  }, [channelId, target?.type === "channel" ? target.channel.members : null]);
  useEffect(() => { setSelectedMember(null); }, [target?.type === "channel" ? target.channel._id : null]);
  const { startCall, state: callState } = useCall();
  const presence = useUserPresence(target?.type === "dm" ? target.contact._id : undefined);
  const bannerStyle = useProfileBannerStyle(
    target?.type === "dm" ? target.contact.banner : undefined,
    target?.type === "dm" ? target.contact.color : undefined,
    target?.type === "dm" ? target.contact.username : undefined,
  );
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
  const channel = !isDm ? channelDetails?._id === channelId ? channelDetails : target.channel : null;
  const memberCount = channel ? channel.memberCount ?? channel.members.length : null;
  const members = channel ? Array.from(new Map([channel.admin, ...channel.members].map(member => [member._id, member])).values()) : [];
  const openIdentity = () => { if (isDm) setProfileOpen(true); else onOpenChannelInfo?.(); };

  return (
    <aside className={`conversation-details${!isDm ? " conversation-details--channel" : ""}`}>
      {onClose && <button type="button" className="conversation-details__collapse" onClick={onClose} aria-label={t("chat.details.hidePanel")} title={t("chat.details.hidePanel")}><ChevronRight size={20} /></button>}
      {isDm && <div className="conversation-details__cover" style={bannerStyle} aria-hidden="true" />}
      <div className="conversation-details__identity">
        <button type="button" className="conversation-details__avatar-button" disabled={!isDm && !onOpenChannelInfo} onClick={openIdentity} aria-label={t(isDm ? "chat.window.contactProfile" : "chat.details.quickInfo")}>
        <Avatar
          displayName={isDm ? target.contact.displayName : target.channel.name}
          username={isDm ? target.contact.username : undefined}
          image={isDm ? target.contact.image : target.channel.image}
          color={isDm ? target.contact.color : undefined}
          placeholder={isDm ? undefined : "#"}
          size={80}
        />
        </button>
        <button type="button" className="conversation-details__name-button" disabled={!isDm && !onOpenChannelInfo} onClick={openIdentity}><h2>{title}</h2></button>
        {isDm && <span className={online ? "conversation-details__online" : ""}>{t(online ? "user.availability.online" : "user.availability.offline")}</span>}
        {!isDm && memberCount !== null && (
          <span>
            {memberCount} {t("chat.details.members")}
          </span>
        )}
      </div>

      {isDm && <div className="conversation-details__section">
        <h3>{t("chat.details.about")}</h3>
        <p>{description}</p>
      </div>}

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
      {!isDm && <div className="conversation-details__section">
        <h3>{t("modals.channelSettings.membersTitle")}</h3>
        {membersLoading && <LoadingSkeleton label={t("common.loading")} />}
        {membersError && <p role="alert">{t("errors.generic")}</p>}
        {!membersLoading && <>
          <div className="conversation-details__members">{members.slice(0, visibleMembers).map(member => <ChannelMember key={member._id} member={member} isAdmin={member._id === channel?.admin._id} onOpen={() => setSelectedMember(member)} />)}</div>
          {members.length > visibleMembers && <button type="button" className="conversation-details__show-more" onClick={() => setVisibleMembers(count => count + 5)}>{t("chat.details.showMoreMembers")}</button>}
        </>}
      </div>}
      <ConversationMedia key={mutedKey} target={target} />
      {!isDm && selectedMember && <OtherProfile variant="sheet" isOpen={true} onClose={() => setSelectedMember(null)} user={selectedMember} isFriend={false} />}
      {isDm && <OtherProfile variant="sheet" isOpen={profileOpen} onClose={() => setProfileOpen(false)} user={target.contact} isFriend={false} canCall={callState === "idle"} onCall={kind => { if (callState === "idle") startCall({ _id: target.contact._id, username: target.contact.username, displayName: target.contact.displayName, image: target.contact.image, color: target.contact.color }, kind); }} />}
    </aside>
  );
}
