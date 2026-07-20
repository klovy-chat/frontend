import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { userLabel, formatJoinedDate, availabilityStatusLabel } from "../../utils/user/format";
import { presenceColor } from "../../utils/user/presence";
import { useProfileBannerStyle } from "../../hooks/usePublicMediaCacheRevision";
import { useAnimatedModal } from "../../hooks/useAnimatedModal";
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
  /** Inkrementowany przy każdym otwarciu — anuluje opóźnione zamykanie. */
  openKey?: number;
}

export function OtherUserProfileModal({
  isOpen,
  onClose,
  user,
  isFriend,
  isBlockedByMe = false,
  onRemove,
  onToggleBlock,
  openKey = 0,
}: OtherUserProfileModalProps) {
  const { t } = useTranslation();
  const displayedUserRef = useRef<Contact | null>(null);

  if (user) {
    displayedUserRef.current = user;
  }

  const { closing, visible, requestClose } = useAnimatedModal(isOpen, onClose, {
    resetKey: user ? `${user._id}:${openKey}` : openKey,
  });

  const displayedUser = user ?? displayedUserRef.current;
  const bannerStyle = useProfileBannerStyle(
    displayedUser?.banner,
    displayedUser?.color,
    displayedUser?.username,
  );

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, requestClose]);

  if (!visible || !displayedUser) return null;

  const name = userLabel(displayedUser);
  const bioText = displayedUser.bio?.trim();
  const joinedLabel = displayedUser.createdAt
    ? formatJoinedDate(displayedUser.createdAt)
    : null;

  return createPortal(
    <div
      className={`up-backdrop${closing ? " closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("modals.otherUserProfile.ariaLabel")}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          e.preventDefault();
          requestClose();
        }
      }}
    >
      <div
        className={`up-card${closing ? " closing" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
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
                displayName={displayedUser.displayName}
                username={displayedUser.username}
                image={displayedUser.image}
                color={displayedUser.color}
                size={64}
              />
              <span
                className="presence-dot"
                title={
                  displayedUser.isOnline
                    ? availabilityStatusLabel(displayedUser.availabilityStatus ?? "online")
                    : availabilityStatusLabel("offline")
                }
                style={{
                  background: presenceColor(displayedUser),
                }}
              />
            </div>
          </div>

          <div className="up-identity">
            <div className="up-identity-text">
              <h2 className="up-display-name">
                {name}
              </h2>
              {displayedUser.username && (
                <p className="up-profile-handle">@{displayedUser.username}</p>
              )}
            </div>
          </div>

          <ListeningActivitySection activity={displayedUser.listeningActivity} />

          {!isFriend ? (
            <p className="up-not-friend-hint">
              {t("modals.otherUserProfile.addFriend")}
            </p>
          ) : null}

          <ProfileBadgesSection badges={displayedUser.badges} />

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

          {isFriend && (onToggleBlock || onRemove) ? (
            <>
              <div className="up-divider" />
              <div className="up-danger-actions">
                {onToggleBlock ? (
                  <button
                    type="button"
                    className={`up-danger-btn${isBlockedByMe ? " up-danger-btn--neutral" : ""}`}
                    onClick={() => void onToggleBlock()}
                  >
                    {isBlockedByMe
                      ? t("modals.otherUserProfile.unblock")
                      : t("modals.otherUserProfile.block")}
                  </button>
                ) : null}
                {onRemove ? (
                  <button
                    type="button"
                    className="up-danger-btn"
                    onClick={() => {
                      requestClose();
                      window.setTimeout(() => onRemove(), 240);
                    }}
                  >
                    {t("modals.otherUserProfile.removeContact")}
                  </button>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
