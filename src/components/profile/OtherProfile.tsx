// OtherProfile.tsx
// Profil kogoś innego: bio, status, dodaj/zablokuj.
// Zakres:
//  - resetKey przy zmianie usera, żeby nie zamknąć złego modalu
//  - bio, status, dodaj/zablokuj; resetKey przy zmianie usera
// Przyjaźń: friends API + cache.
// Przy zmianach: useModal.ts, api/friends.ts.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle, Phone, Video, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getContactProfile } from "../../api/contacts";
import { Avatar } from "../common/Avatar";
import { userLabel, formatJoinedDate, formatLastSeen } from "../../utils/user/format";
import { renderFormattedText } from "../../utils/chat/format";
import { useProfileBannerStyle } from "../../hooks/useMediaCache";
import { useModal } from "../../hooks/useModal";
import { useUserPresence } from "../../context/PresenceContext";
import type { Contact } from "../../types";
import "../../styles/account/profile.css";

interface OtherProfileProps {
  variant?: "modal" | "sheet";
  onCall?: (kind: "audio" | "video") => void;
  canCall?: boolean;
  isOpen: boolean;
  onClose: () => void;
  user: Contact | null;
  isFriend: boolean;

  friendshipLoading?: boolean;
  isBlockedByMe?: boolean;
  onRemove?: () => void;
  onToggleBlock?: () => void | Promise<void>;

  openKey?: number;
}

export function OtherProfile({
  variant = "modal",
  onCall,
  canCall = false,
  isOpen,
  onClose,
  user,
  isFriend,
  friendshipLoading = false,
  isBlockedByMe = false,
  onRemove,
  onToggleBlock,
  openKey = 0,
}: OtherProfileProps) {
  const { t } = useTranslation();
  const displayedUserRef = useRef<Contact | null>(null);
  const [loadedProfile, setLoadedProfile] = useState<Contact | null>(null);
  const live = useUserPresence(user?._id);

  if (user) {
    displayedUserRef.current = user;
  }

  const { closing, visible, requestClose } = useModal(isOpen, onClose, {
    resetKey: user ? `${user._id}:${openKey}` : openKey,
  });

  useEffect(() => {
    if (!visible || !user?._id || !isFriend) {
      setLoadedProfile(null);
      return;
    }

    let cancelled = false;
    void getContactProfile(user._id)
      .then(({ contact }) => {
        if (!cancelled) setLoadedProfile(contact);
      })
      .catch(() => {
        if (!cancelled) setLoadedProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, user?._id, isFriend, openKey]);

  const base = loadedProfile ?? user ?? displayedUserRef.current;
  const displayedUser = base
    ? {
        ...base,
        isOnline: live?.isOnline ?? base.isOnline,
        lastSeen: live?.lastSeen ?? base.lastSeen,
      }
    : null;
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

  if (variant === "sheet") return createPortal(
    <div className="contact-sheet-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) requestClose(); }}>
      <aside className="contact-sheet" role="dialog" aria-modal="true" aria-label={t("nav.items.profile")}>
        <header><strong>{t("nav.items.profile")}</strong><button type="button" autoFocus aria-label={t("common.close")} onClick={requestClose}><X size={18} /></button></header>
        <div className="contact-sheet__banner" style={bannerStyle} aria-hidden="true" />
        <div className="contact-sheet__identity contact-sheet__identity--banner">
          <Avatar displayName={displayedUser.displayName} username={displayedUser.username} image={displayedUser.image} color={displayedUser.color} size={96} />
          <h2>{name}</h2><span>@{displayedUser.username}</span>
          <span className={displayedUser.isOnline ? "contact-sheet__online" : ""}>{formatLastSeen(displayedUser.lastSeen, { isOnline: displayedUser.isOnline })}</span>
          {bioText && <p>{bioText}</p>}
        </div>
        <div className="contact-sheet__actions">
          <button type="button" className="contact-sheet__write" onClick={requestClose}><MessageCircle size={16} />{t("chat.sheet.write")}</button>
          {onCall && <>
            <button type="button" disabled={!canCall} onClick={() => { requestClose(); onCall("audio"); }}><Phone size={16} />{t("chat.window.call")}</button>
            <button type="button" disabled={!canCall} onClick={() => { requestClose(); onCall("video"); }}><Video size={16} />{t("chat.window.videoCall")}</button>
          </>}
        </div>
      </aside>
    </div>, document.body,
  );
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
              <p className="up-profile-status">
                {formatLastSeen(displayedUser.lastSeen, {
                  isOnline: displayedUser.isOnline,
                  blocked: isBlockedByMe,
                })}
              </p>
            </div>
          </div>

          {!friendshipLoading && !isFriend ? (
            <p className="up-not-friend-hint">
              {t("modals.otherUserProfile.addFriend")}
            </p>
          ) : null}

          {bioText ? (
            <section className="up-bio-section">
              <span className="up-section-label">{t("modals.otherUserProfile.about")}</span>
              <p className="up-bio-text">{renderFormattedText(bioText)}</p>
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
