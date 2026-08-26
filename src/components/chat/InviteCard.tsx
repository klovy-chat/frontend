// InviteCard.tsx
// Karta zaproszenia w dymku (nazwa kanału, dołącz).
// Zakres:
//  - link z treści wiadomości
//  - nazwa kanału z preview API, nie z samego URL
// Preview kodu: api/invites, nie zgaduj nazwy kanału z URL.
// Przy zmianach: embeds.ts, pages/Invite.tsx.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  acceptChannelInvite,
  getChannelInvite,
} from "../../api/invites";
import { getUserChannels } from "../../api/channels";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { Avatar } from "../common/Avatar";
import { userLabel } from "../../utils/user/format";
import type { ResolvedInviteLink } from "../../utils/chat/embeds";

type InvitePreview = NonNullable<
  Awaited<ReturnType<typeof getChannelInvite>>["invite"]
>;

const inviteCache = new Map<string, InvitePreview>();
const inviteInflight = new Map<string, Promise<InvitePreview | null>>();

async function loadInvitePreview(inviteId: string): Promise<InvitePreview | null> {
  const cached = inviteCache.get(inviteId);
  if (cached) return cached;

  const inflight = inviteInflight.get(inviteId);
  if (inflight) return inflight;

  const request = getChannelInvite(inviteId)
    .then((res) => {
      inviteCache.set(inviteId, res.invite);
      return res.invite;
    })
    .catch(() => null)
    .finally(() => {
      inviteInflight.delete(inviteId);
    });

  inviteInflight.set(inviteId, request);
  return request;
}

function formatEstablishedDate(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    year: "numeric",
  }).format(date);
}

interface InviteCardProps {
  link: ResolvedInviteLink;
}

export function InviteCard({ link }: InviteCardProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [preview, setPreview] = useState<InvitePreview | null>(
    () => inviteCache.get(link.inviteId) ?? null,
  );
  const [loading, setLoading] = useState(!preview);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(!inviteCache.has(link.inviteId));

    void loadInvitePreview(link.inviteId).then((data) => {
      if (cancelled) return;
      setPreview(data);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [link.inviteId]);

  const channel = preview?.channelId;
  const channelName = channel?.name ?? t("auth.invite.channelFallback");
  const memberCount = channel?.memberCount ?? 0;
  const description = channel?.description?.trim();
  const inviterName = preview?.inviter ? userLabel(preview.inviter) : null;
  const established =
    channel?.createdAt != null
      ? formatEstablishedDate(channel.createdAt, i18n.language)
      : "";
  const joinable = preview?.joinable ?? false;

  const handleAction = async () => {
    if (!joinable) return;

    if (!user) {
      navigate(`/invite/${link.inviteId}`);
      return;
    }

    setJoining(true);
    try {
      const res = await acceptChannelInvite(link.inviteId);
      await getUserChannels();
      toast.success(t("auth.invite.joinedToast"));
      navigate("/", {
        replace: false,
        state: { openChannelId: String(res.channelId) },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("auth.invite.joinFailed");
      toast.error(message);
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="message-invite-embed message-invite-embed--loading">
        <div className="message-invite-embed__skeleton" />
      </div>
    );
  }

  if (!preview || !channel) {
    return (
      <div className="message-invite-embed message-invite-embed--error">
        <span className="message-invite-embed__label">
          {t("chat.inviteEmbed.label")}
        </span>
        <p className="message-invite-embed__error">
          {t("chat.inviteEmbed.loadFailed")}
        </p>
      </div>
    );
  }

  return (
    <div className="message-invite-embed">
      <span className="message-invite-embed__label">
        {t("chat.inviteEmbed.label")}
      </span>

      <div className="message-invite-embed__header">
        <div className="message-invite-embed__avatar">
          <Avatar
            displayName={channelName}
            image={channel.image}
            placeholder="#"
            size={48}
          />
        </div>
        <div className="message-invite-embed__meta">
          <h4 className="message-invite-embed__name">{channelName}</h4>
          {memberCount > 0 ? (
            <div className="message-invite-embed__stats">
              <span className="message-invite-embed__stat">
                <span
                  className="message-invite-embed__stat-dot message-invite-embed__stat-dot--members"
                  aria-hidden
                />
                {t("presence.channelMember", { count: memberCount })}
              </span>
            </div>
          ) : null}
          {established ? (
            <span className="message-invite-embed__established">
              {t("chat.inviteEmbed.established", { date: established })}
            </span>
          ) : null}
        </div>
      </div>

      {inviterName ? (
        <p className="message-invite-embed__inviter">
          {t("chat.inviteEmbed.invitedBy", { name: inviterName })}
        </p>
      ) : null}

      {description ? (
        <p className="message-invite-embed__description">{description}</p>
      ) : null}

      <button
        type="button"
        className="message-invite-embed__button"
        disabled={!joinable || joining}
        onClick={() => void handleAction()}
      >
        {joining
          ? t("auth.invite.joining")
          : joinable
            ? t("chat.inviteEmbed.joinButton")
            : t("chat.inviteEmbed.unavailable")}
      </button>
    </div>
  );
}
