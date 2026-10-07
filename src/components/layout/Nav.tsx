// Nav.tsx
// Lewa szyna: czat, kontakty, ustawienia, status, avatar.
// Zakres:
//  - badge na czatach z unread.ts
//  - czat / kontakty / ustawienia / status / avatar
// Nowa pozycja nav: tu + i18n + ewentualnie App route.
// Przy zmianach: pages/Chat.tsx, UnreadBadge.tsx, styles/nav/nav.css.

import { useEffect, useState } from "react";
import { Home, Phone, User, MessageCircle, Users, Settings, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../context/AuthContext";
import { Avatar } from "../common/Avatar";
import { userLabel } from "../../utils/user/format";
import { useTheme } from "../../context/ThemeContext";
import { LOGO_COLOUR_URL, LOGO_FOREST_URL } from "../../constants/branding";
import "../../styles/nav/nav.css";

interface NavProps {
  onOpenCalls?: () => void;
  callsActive?: boolean;
  onOpenHome?: () => void;
  homeActive?: boolean;
  onOpenChats: () => void;
  onOpenSettings: () => void;
  onOpenProfile?: () => void;
  profileActive?: boolean;
  onOpenContacts: () => void;
  totalUnread: number;
  receivedFriendRequests?: number;
  settingsActive?: boolean;
  contactsActive?: boolean;
}

export function Nav({
  onOpenCalls,
  callsActive = false,
  onOpenHome,
  homeActive = false,
  onOpenChats,
  onOpenSettings,
  onOpenProfile,
  profileActive = false,
  onOpenContacts,
  totalUnread,
  receivedFriendRequests = 0,
  settingsActive = false,
  contactsActive = false,
}: NavProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const { theme } = useTheme();

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <nav className="nav-rail">
      <div className="nav-rail__brand">
        <img
          src={theme === "forest" ? LOGO_FOREST_URL : LOGO_COLOUR_URL}
          alt=""
          className="nav-rail__brand-logo"
          width={32}
          height={32}
          decoding="async"
        />
        <div className="nav-rail__brand-text">
          <div className="nav-rail__title">{t("nav.brand.title")}</div>
          <div className="nav-rail__subtitle nav-rail__subtitle--clock">
            {now.toLocaleDateString("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" })}{" "}
            {now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit", hour12: false })}
          </div>
        </div>
      </div>

      <div className="nav-rail__scroll">
        <div>
          <div className="nav-rail__group-label">{t("nav.groups.messages")}</div>
          {onOpenHome && (
            <button type="button" className={`nav-rail__item${homeActive && !contactsActive ? " active" : ""}`} onClick={onOpenHome} aria-current={homeActive && !contactsActive ? "page" : undefined}>
              <span className="nav-rail__icon"><Home size={18} strokeWidth={1.75} /></span>
              {t("nav.items.home")}
            </button>
          )}
          <button
            type="button"
            className={`nav-rail__item${!settingsActive && !contactsActive && !homeActive && !callsActive && !profileActive ? " active" : ""}`}
            onClick={onOpenChats}
          >
            <span className="nav-rail__icon">
              <MessageCircle size={18} strokeWidth={1.75} />
            </span>
            {t("nav.items.chats")}
            {totalUnread > 0 && <span className="nav-rail__badge">{totalUnread > 99 ? "99+" : totalUnread}</span>}
          </button>
          {onOpenCalls && <button type="button" className={`nav-rail__item${callsActive && !contactsActive ? " active" : ""}`} onClick={onOpenCalls} aria-current={callsActive && !contactsActive ? "page" : undefined}>
            <span className="nav-rail__icon"><Phone size={18} strokeWidth={1.75} /></span>{t("nav.items.calls")}
          </button>}
          <button type="button" className={`nav-rail__item${contactsActive ? " active" : ""}`} onClick={onOpenContacts}>
            <span className="nav-rail__icon">
              <Users size={18} strokeWidth={1.75} />
            </span>
            {t("nav.items.contacts")}
            {receivedFriendRequests > 0 && (
              <span className="nav-rail__badge">
                {receivedFriendRequests > 9 ? "9+" : receivedFriendRequests}
              </span>
            )}
          </button>
        </div>

        <div>
          <div className="nav-rail__group-label">{t("nav.groups.account")}</div>
          {onOpenProfile && (
            <button type="button" className={`nav-rail__item${profileActive ? " active" : ""}`} aria-current={profileActive ? "page" : undefined} onClick={onOpenProfile}>
              <span className="nav-rail__icon"><User size={18} strokeWidth={1.75} /></span>
              {t("nav.items.profile")}
            </button>
          )}
          <button
            type="button"
            className={`nav-rail__item${settingsActive ? " active" : ""}`}
            onClick={onOpenSettings}
          >
            <span className="nav-rail__icon">
              <Settings size={18} strokeWidth={1.75} />
            </span>
            {t("nav.items.settings")}
          </button>
        </div>
      </div>

      <div className="nav-rail__footer nav-rail__footer-wrap">
        <div className="nav-rail__profile">
          <button
            type="button"
            className="nav-rail__profile-avatar-btn"
            title={t("nav.items.viewProfile")}
            aria-label={t("nav.items.viewProfile")}
            onClick={() => onOpenProfile?.()}
          >
            <Avatar
              displayName={user?.displayName}
              username={user?.username}
              image={user?.image}
              color={user?.color}
            />
          </button>
          <div className="nav-rail__profile-status-btn">
            <div className="nav-rail__profile-info">
              <div className="nav-rail__profile-name">{userLabel(user)}</div>
              <div className="nav-rail__profile-status">{t("user.availability.online")}</div>
            </div>
          </div>
          <button type="button" className="nav-rail__logout" title={t("common.logoutTitle")} onClick={() => logout()}>
            <LogOut size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </nav>
  );
}
