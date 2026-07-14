import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { updateAvailabilityStatus } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import { useWebSocket } from "../../context/WebSocketContext";
import { WsType } from "../../api/wsProtocol";
import { Avatar } from "../common/Avatar";
import { userLabel, formatLiveDateTime, availabilityStatusLabel } from "../../utils/user/format";
import { presenceColor } from "../../utils/user/presence";
import "../../styles/nav/nav.css";

interface AppNavRailProps {
  onOpenSettings: () => void;
  onOpenContacts: () => void;
  onOpenAdmin: () => void;
  totalUnread: number;
}

export function AppNavRail({
  onOpenSettings,
  onOpenContacts,
  onOpenAdmin,
  totalUnread,
}: AppNavRailProps) {
  const { t } = useTranslation();
  const { user, logout, updateUser } = useAuth();
  const ws = useWebSocket();
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const statusMenuRef = useRef<HTMLDivElement>(null);
  const ownStatus = user?.availabilityStatus ?? "online";

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!statusMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setStatusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [statusMenuOpen]);

  const handleStatusChange = async (status: "online" | "away" | "brb" | "dnd") => {
    if (!user) return;
    try {
      const updated = await updateAvailabilityStatus(status);
      updateUser(updated);
      ws?.send(WsType.SET_STATUS, { availabilityStatus: status });
    } catch {
      /**/
    }
    setStatusMenuOpen(false);
  };

  return (
    <nav className="nav-rail">
      <div className="nav-rail__brand">
        <div className="nav-rail__brand-text">
          <div className="nav-rail__title">{t("nav.brand.title")}</div>
          <div className="nav-rail__subtitle nav-rail__subtitle--clock">
            {formatLiveDateTime(now)}
          </div>
        </div>
      </div>

      <div className="nav-rail__scroll">
        <div>
          <div className="nav-rail__group-label">{t("nav.groups.workspace")}</div>
          <button
            type="button"
            className="nav-rail__item active"
          >
            <span className="nav-rail__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            {t("nav.items.chats")}
            {totalUnread > 0 && <span className="nav-rail__badge">{totalUnread > 99 ? "99+" : totalUnread}</span>}
          </button>
          <button type="button" className="nav-rail__item" onClick={onOpenContacts}>
            <span className="nav-rail__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </span>
            {t("nav.items.contacts")}
          </button>
        </div>

        <div>
          <div className="nav-rail__group-label">{t("nav.groups.account")}</div>
          <button type="button" className="nav-rail__item" onClick={onOpenSettings}>
            <span className="nav-rail__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </span>
            {t("nav.items.settings")}
          </button>
          {user?.isPanelAdmin && (
            <button type="button" className="nav-rail__item" onClick={onOpenAdmin}>
              <span className="nav-rail__icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </span>
              {t("nav.items.admin")}
            </button>
          )}
        </div>
      </div>

      <div className="nav-rail__footer nav-rail__footer-wrap">
        {statusMenuOpen && (
          <div ref={statusMenuRef} className="nav-rail__status-menu">
            {(["online", "away", "brb", "dnd"] as const).map((status) => (
              <button
                key={status}
                type="button"
                className={`nav-rail__status-item${ownStatus === status ? " active" : ""}`}
                onClick={() => handleStatusChange(status)}
              >
                <span
                  className="nav-rail__status-dot"
                  style={{ background: presenceColor({ isOnline: true, availabilityStatus: status }) }}
                />
                {availabilityStatusLabel(status)}
              </button>
            ))}
          </div>
        )}
        <div className="nav-rail__profile">
          <button
            type="button"
            style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}
            onClick={() => setStatusMenuOpen((v) => !v)}
          >
            <div style={{ position: "relative", display: "inline-flex" }}>
              <Avatar
                displayName={user?.displayName}
                username={user?.username}
                image={user?.image}
                color={user?.color}
              />
              <span
                className="presence-dot"
                style={{ background: presenceColor({ isOnline: true, availabilityStatus: ownStatus }) }}
              />
            </div>
            <div className="nav-rail__profile-info">
              <div className="nav-rail__profile-name">{userLabel(user)}</div>
              <div
                className="nav-rail__profile-status"
                style={{ color: presenceColor({ isOnline: true, availabilityStatus: ownStatus }) }}
              >
                {availabilityStatusLabel(ownStatus)}
              </div>
            </div>
          </button>
          <button type="button" className="nav-rail__logout" title={t("common.logoutTitle")} onClick={() => logout()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
}
