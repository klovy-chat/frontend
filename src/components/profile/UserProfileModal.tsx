import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { ProfileBadgesSection } from "./ProfileBadgesSection";
import { useAuth } from "../../context/AuthContext";
import { useUserPresence } from "../../context/PresenceContext";
import { userLabel, formatJoinedDate, availabilityStatusLabel } from "../../utils/user/format";
import { renderFormattedText } from "../../utils/chat/messageFormat";
import { presenceColor } from "../../utils/user/presence";
import { useProfileBannerStyle } from "../../hooks/usePublicMediaCacheRevision";
import { useAnimatedModal } from "../../hooks/useAnimatedModal";
import type { User } from "../../types";
import "../../styles/account/profile.css";
import "../common/badge.css";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenSettings?: () => void;
  /** Np. niezapisany szkic z ustawień profilu — podgląd „jak widzą inni”. */
  previewOverride?: Partial<User> | null;
}

export function UserProfileModal({
  isOpen,
  onClose,
  onOpenSettings,
  previewOverride = null,
}: UserProfileModalProps) {
  const { t } = useTranslation();
  const { user: authUser } = useAuth();
  const baseUser =
    authUser && previewOverride
      ? { ...authUser, ...previewOverride }
      : authUser;
  const live = useUserPresence(baseUser?.id);
  const resolved = baseUser
    ? {
        ...baseUser,
        isOnline: live?.isOnline ?? baseUser.isOnline,
        availabilityStatus:
          live?.availabilityStatus ?? baseUser.availabilityStatus,
        lastSeen: live?.lastSeen ?? baseUser.lastSeen,
      }
    : null;
  // Logged-in user is online in this session; match nav-rail behavior.
  const user = resolved
    ? { ...resolved, isOnline: resolved.isOnline ?? true }
    : null;
  const { closing, visible, requestClose } = useAnimatedModal(isOpen, onClose, {
    resetKey: user?.id ?? null,
  });

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, requestClose]);

  const bannerStyle = useProfileBannerStyle(user?.banner, user?.color, user?.username ?? "");

  if (!visible || !user) return null;

  const name = userLabel(user);
  const joinedLabel = user.createdAt ? formatJoinedDate(user.createdAt) : t("common.emDash");
  const bioText = user.bio?.trim();

  return createPortal(
    <div
      className={`up-backdrop${closing ? " closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("modals.userProfile.ariaLabel")}
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
            <h2 className="up-display-name">{name}</h2>
            <p className="up-profile-handle">@{user.username}</p>
          </div>

          <ProfileBadgesSection badges={user.badges} />

          {bioText ? (
            <section className="up-bio-section">
              <span className="up-section-label">{t("modals.userProfile.about")}</span>
              <p className="up-bio-text">{renderFormattedText(bioText)}</p>
            </section>
          ) : null}

          <div className="up-divider" />

          {onOpenSettings ? (
            <button
              type="button"
              className="up-edit-profile-btn"
              onClick={() => {
                requestClose();
                window.setTimeout(() => onOpenSettings(), 240);
              }}
            >
              {t("modals.userProfile.editProfile")}
            </button>
          ) : null}

          <section className="up-section up-section--joined">
            <span className="up-section-label">{t("modals.userProfile.joined")}</span>
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
        </div>
      </div>
    </div>,
    document.body,
  );
}
