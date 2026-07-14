import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { userLabel, formatJoinedDate, availabilityStatusLabel } from "../../utils/user/format";
import { presenceColor } from "../../utils/user/presence";
import { useProfileBannerStyle } from "../../hooks/usePublicMediaCacheRevision";
import { ListeningActivitySection } from "./ListeningActivitySection";
import { ProfileBadgesSection } from "./ProfileBadgesSection";
import type { Contact } from "../../types";
import "../../styles/account/profile.css";
import "../common/badge.css";

interface OtherUserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Contact | null;
  isFriend: boolean;
  isBlockedByMe?: boolean;
  onRemove?: () => void;
  onToggleBlock?: () => void | Promise<void>;
}

export function OtherUserProfileModal({
  isOpen,
  onClose,
  user,
  isFriend,
  isBlockedByMe = false,
  onRemove,
  onToggleBlock,
}: OtherUserProfileModalProps) {
  const { t } = useTranslation();
  const [closing, setClosing] = useState(false);

  const requestClose = () => {
    if (closing) return;
    setClosing(true);
    document.body.style.overflow = "";
    window.setTimeout(() => onClose(), 220);
  };

  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, closing]);

  const bannerStyle = useProfileBannerStyle(user?.banner, user?.color, user?.username);

  if (!isOpen && !closing) return null;
  if (!user) return null;

  const name = userLabel(user);
  const bioText = user.bio?.trim();
  const joinedLabel = user.createdAt ? formatJoinedDate(user.createdAt) : null;

  return (
    <div
      className={`up-backdrop${closing ? " closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("modals.otherUserProfile.ariaLabel")}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div
        className={`up-card${closing ? " closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="up-banner" style={bannerStyle} aria-hidden />

        <button
          type="button"
          className="up-close"
          aria-label={t("common.close")}
          onClick={requestClose}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="up-body">
          <div className="up-profile-header">
            <div className="up-avatar-wrap" style={{ position: "relative", display: "inline-flex" }}>
              <Avatar
                displayName={user.displayName}
                username={user.username}
                image={user.image}
                color={user.color}
                size={64}
              />
              <span
                className="presence-dot"
                title={
                  user.isOnline
                    ? availabilityStatusLabel(user.availabilityStatus ?? "online")
                    : availabilityStatusLabel("offline")
                }
                style={{
                  background: presenceColor(user),
                }}
              />
            </div>
          </div>

          <div className="up-identity">
            <div className="up-identity-text">
              <h2 className="up-display-name">
                {name}
                {user.isBot && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: "0.6em",
                      fontWeight: 700,
                      letterSpacing: "0.04em",
                      color: "#fff",
                      background: "#5865f2",
                      padding: "3px 6px",
                      borderRadius: 5,
                      textTransform: "uppercase",
                      verticalAlign: "middle",
                    }}
                  >
                    {t("modals.otherUserProfile.botBadge")}
                  </span>
                )}
              </h2>
              {user.username && (
                <p className="up-profile-handle">@{user.username}</p>
              )}
            </div>
          </div>

          <ListeningActivitySection activity={user.listeningActivity} />

          {!isFriend ? (
            <p className="up-not-friend-hint">
              {t("modals.otherUserProfile.addFriend")}
            </p>
          ) : null}

          <ProfileBadgesSection badges={user.badges} />

          {bioText ? (
            <section className="up-bio-section">
              <span className="up-section-label">{t("modals.otherUserProfile.about")}</span>
              <p className="up-bio-text">{bioText}</p>
            </section>
          ) : null}

          <div className="up-divider" />

          {joinedLabel ? (
            <section className="up-section up-section--joined">
              <span className="up-section-label">{t("modals.otherUserProfile.joined")}</span>
              <div className="up-joined-row">
                <span className="up-joined-icon" aria-hidden>
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </span>
                <p className="up-joined-value">{joinedLabel}</p>
              </div>
            </section>
          ) : null}

          {isFriend && onToggleBlock ? (
            <>
              <div className="up-divider" />
              <button
                type="button"
                className={`up-remove-contact-btn${isBlockedByMe ? " up-remove-contact-btn--muted" : ""}`}
                onClick={() => void onToggleBlock()}
              >
                {isBlockedByMe ? t("modals.otherUserProfile.unblock") : t("modals.otherUserProfile.block")}
              </button>
            </>
          ) : null}

          {isFriend && onRemove ? (
            <>
              <div className="up-divider" />
              <button
                type="button"
                className="up-remove-contact-btn"
                onClick={() => {
                  requestClose();
                  window.setTimeout(() => onRemove(), 240);
                }}
              >
                {t("modals.otherUserProfile.removeContact")}
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
