// BottomNav.tsx
// Dolna nawigacja na mobile: czaty, kontakty, ustawienia.
// Zakres:
//  - aktywna zakładka, badge unread na czatach
//  - safe-area padding

import { useTranslation } from "react-i18next";
import { MessageCircle, Phone, Users, Settings } from "lucide-react";
import "../../styles/nav/bottom-nav.css";

export type BottomNavTab = "chats" | "calls" | "contacts" | "settings";

interface BottomNavProps {
  active: BottomNavTab;
  totalUnread?: number;
  receivedFriendRequests?: number;
  onChats: () => void;
  onCalls: () => void;
  onContacts: () => void;
  onSettings: () => void;
}

export function BottomNav({ active, totalUnread = 0, receivedFriendRequests = 0, onChats, onCalls, onContacts, onSettings }: BottomNavProps) {
  const { t } = useTranslation();
  const items = [
    { key: "chats", icon: MessageCircle, action: onChats, count: totalUnread },
    { key: "calls", icon: Phone, action: onCalls, count: 0 },
    { key: "contacts", icon: Users, action: onContacts, count: receivedFriendRequests },
    { key: "settings", icon: Settings, action: onSettings, count: 0 },
  ] as const;
  return <nav className="bottom-nav" aria-label={t("nav.groups.workspace")}>
    {items.map(({ key, icon: Icon, action, count }) => <button key={key} type="button" className={`bottom-nav__item${active === key ? " active" : ""}`} onClick={action} aria-current={active === key ? "page" : undefined} aria-label={t(`nav.items.${key}`)}>
      <span className="bottom-nav__icon"><Icon size={20} strokeWidth={1.8} />{count > 0 && <span className="bottom-nav__badge">{count > 99 ? "99+" : count}</span>}</span>
      <span className="bottom-nav__label">{t(`nav.items.${key}`)}</span>
    </button>)}
  </nav>;
}
