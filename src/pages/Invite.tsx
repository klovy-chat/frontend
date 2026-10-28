// Invite.tsx
// Dołączenie do kanału z kodu /invite/:code.
// Zakres:
//  - podgląd, join po zalogowaniu, return URL
//  - podgląd kodu, join po zalogowaniu, return URL
// Format kodu i limity użyć są po stronie invites.rs.
// Przy zmianach: api/invites.ts, controllers/invites.rs.

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { acceptChannelInvite, getChannelInvite } from "../api/invites";
import { getUserChannels } from "../api/channels";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Avatar } from "../components/common/Avatar";
import { AuthLayout } from "../components/auth/AuthLayout";
import { userLabel } from "../utils/user/format";
import "../styles/auth/auth.css";

type InviteStatus = "loading" | "ready" | "joining" | "done" | "error";

interface InviteInviter {
  displayName?: string | null;
  username: string;
  image?: string | null;
  color?: number | null;
}

export function Invite() {
  const { t } = useTranslation();
  const { inviteId } = useParams<{ inviteId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [channelName, setChannelName] = useState("");
  const [channelImage, setChannelImage] = useState<string | null>(null);
  const [inviter, setInviter] = useState<InviteInviter | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!inviteId) {
      const message = t("auth.invite.invalidLink");
      setError(message);
      toast.error(message);
      setStatus("error");
      return;
    }
    getChannelInvite(inviteId)
      .then((res) => {
        setChannelName(res.invite.channelId?.name ?? t("auth.invite.channelFallback"));
        setChannelImage(res.invite.channelId?.image ?? null);
        setInviter(res.invite.inviter ?? null);
        if (!res.invite.joinable) {
          const message = res.invite.expired
            ? t("auth.invite.expired")
            : res.invite.limitReached
              ? t("auth.invite.limitReached")
              : t("auth.invite.revoked");
          setError(message);
          setStatus("error");
          return;
        }
        setStatus("ready");
      })
      .catch(() => {
        const message = t("auth.invite.expired");
        setError(message);
        toast.error(message);
        setStatus("error");
      });
  }, [inviteId, t, toast]);

  const handleJoin = async () => {
    if (!inviteId || !user) return;
    setError("");
    setStatus("joining");
    try {
      const res = await acceptChannelInvite(inviteId);
      await getUserChannels();
      setStatus("done");
      toast.success(t("auth.invite.joinedToast"));
      navigate("/", {
        replace: true,
        state: { openChannelId: String(res.channelId) },
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("auth.invite.joinFailed");
      setError(message);
      toast.error(message);
      setStatus("ready");
    }
  };

  const inviterName = inviter ? userLabel(inviter) : null;

  if (authLoading) {
    return (
      <AuthLayout>
        <div className="al-card al-card--solo al-card--invite al-card--invite-loading">
          <div className="spinner" />
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="al-card al-card--solo al-card--invite">
        {status === "loading" ? (
          <div className="iv-loading">
            <div className="spinner" />
          </div>
        ) : (
          <>
            <div className="iv-channel-avatar">
              <Avatar
                displayName={channelName}
                image={channelImage}
                placeholder="#"
                size={56}
              />
            </div>
            <p className="iv-label">{t("auth.invite.title")}</p>
            <h1 className="iv-channel">{channelName}</h1>

            {inviter && inviterName ? (
              <div className="iv-inviter">
                <Avatar
                  displayName={inviter.displayName}
                  username={inviter.username}
                  image={inviter.image}
                  color={inviter.color}
                  size={36}
                />
                <p className="iv-inviter-text">
                  {t("auth.invite.inviterMessage", { name: inviterName })}
                </p>
              </div>
            ) : null}

            {status === "ready" && !user ? (
              <p className="iv-hint">{t("auth.invite.loginRequired")}</p>
            ) : null}

            {error ? (
              <div className="al-error iv-error" role="alert">
                {error}
              </div>
            ) : null}

            {status === "ready" ? (
              user ? (
                <button
                  type="button"
                  className="al-btn-submit iv-btn-join"
                  onClick={() => void handleJoin()}
                >
                  {t("auth.invite.joinButton")}
                </button>
              ) : (
                <Link to="/login" className="al-btn-submit iv-btn-join">
                  {t("auth.login.submit")}
                </Link>
              )
            ) : null}

            {status === "joining" ? (
              <div className="al-success iv-status">{t("auth.invite.joining")}</div>
            ) : null}

            {status === "done" ? (
              <div className="al-success iv-status">{t("auth.invite.joined")}</div>
            ) : null}

            {status === "error" ? (
              <button
                type="button"
                className="al-btn-submit iv-btn-join"
                onClick={() => navigate("/")}
              >
                {t("auth.invite.backToChat")}
              </button>
            ) : null}

            {(status === "ready" || status === "joining") && (
              <button
                type="button"
                className="iv-btn-dismiss"
                onClick={() => navigate("/")}
                disabled={status === "joining"}
              >
                {t("auth.invite.dismiss")}
              </button>
            )}
          </>
        )}
      </div>
    </AuthLayout>
  );
}
