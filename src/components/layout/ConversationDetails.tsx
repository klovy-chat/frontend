import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { userLabel } from "../../utils/user/format";
import type { ChatTarget } from "../../types";

interface ConversationDetailsProps {
  target: ChatTarget | null;
}

export function ConversationDetails({ target }: ConversationDetailsProps) {
  const { t } = useTranslation();

  if (!target) {
    return (
      <aside className="conversation-details conversation-details--empty">
        <span className="conversation-details__empty-mark">+</span>
        <p>{t("chat.empty.selectChat")}</p>
      </aside>
    );
  }

  const isDm = target.type === "dm";
  const title = isDm ? userLabel(target.contact) : target.channel.name;
  const description = isDm
    ? target.contact.bio || t("chat.details.noBio")
    : target.channel.description || t("chat.details.noDescription");
  const memberCount = isDm ? null : target.channel.memberCount ?? target.channel.members.length;

  return (
    <aside className="conversation-details">
      <div className="conversation-details__cover" />
      <div className="conversation-details__identity">
        <Avatar
          displayName={isDm ? target.contact.displayName : target.channel.name}
          username={isDm ? target.contact.username : undefined}
          image={isDm ? target.contact.image : target.channel.image}
          color={isDm ? target.contact.color : undefined}
          placeholder={isDm ? undefined : "#"}
          size={72}
        />
        <h2>{title}</h2>
        {isDm && target.contact.username && <span>@{target.contact.username}</span>}
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
          {!isDm && (
            <div>
              <span>{t("chat.details.admin")}</span>
              <strong>{userLabel(target.channel.admin)}</strong>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
