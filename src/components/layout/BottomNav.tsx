// BottomNav.tsx
// Dolna nawigacja na mobile: czaty, kontakty, ustawienia.
// Zakres:
//  - aktywna zakładka, badge unread na czatach
//  - safe-area padding

import { useTranslation } from "react-i18next";
import "../../styles/nav/bottom-nav.css";

export type BottomNavTab = "chats" | "contacts" | "settings";

interface BottomNavProps {
  active: BottomNavTab;
  totalUnread?: number;
  onChats: () => void;
  onContacts: () => void;
  onSettings: () => void;
}

export function BottomNav({
  active,
  totalUnread = 0,
  onChats,
  onContacts,
  onSettings,
}: BottomNavProps) {
  const { t } = useTranslation();
  const unreadLabel = totalUnread > 99 ? "99+" : String(totalUnread);

  return (
    <nav className="bottom-nav" aria-label={t("nav.groups.workspace")}>
      <button
        type="button"
        className={`bottom-nav__item${active === "chats" ? " active" : ""}`}
        onClick={onChats}
        aria-current={active === "chats" ? "page" : undefined}
      >
        <span className="bottom-nav__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {totalUnread > 0 && (
            <span className="bottom-nav__badge">{unreadLabel}</span>
          )}
        </span>
        <span className="bottom-nav__label">{t("nav.items.chats")}</span>
      </button>

      <button
        type="button"
        className={`bottom-nav__item${active === "contacts" ? " active" : ""}`}
        onClick={onContacts}
        aria-current={active === "contacts" ? "page" : undefined}
      >
        <span className="bottom-nav__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        </span>
        <span className="bottom-nav__label">{t("nav.items.contacts")}</span>
      </button>

      <button
        type="button"
        className={`bottom-nav__item${active === "settings" ? " active" : ""}`}
        onClick={onSettings}
        aria-current={active === "settings" ? "page" : undefined}
      >
        <span className="bottom-nav__icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </span>
        <span className="bottom-nav__label">{t("nav.items.settings")}</span>
      </button>
    </nav>
  );
}
