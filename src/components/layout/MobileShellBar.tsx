import { useTranslation } from "react-i18next";
import type { ShellOverlay } from "./MobileShellBar.types";

export type { ShellOverlay };

interface MobileShellBarProps {
  title: string;
  overlay: ShellOverlay;
  onOverlayChange: (panel: ShellOverlay) => void;
  showList?: boolean;
  showAppNav?: boolean;
  variant?: "chat" | "settings";
  onClose?: () => void;
}

function toggle(current: ShellOverlay, panel: ShellOverlay): ShellOverlay {
  return current === panel ? null : panel;
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SectionsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function MobileShellBar({
  title,
  overlay,
  onOverlayChange,
  showList = true,
  showAppNav = true,
  variant = "chat",
  onClose,
}: MobileShellBarProps) {
  const { t } = useTranslation();

  if (variant === "settings") {
    return (
      <div className="mobile-shell-bar mobile-shell-bar--settings">
        <div className="mobile-shell-bar__leading">
          {showAppNav ? (
            <button
              type="button"
              className={`mobile-shell-bar__btn mobile-shell-bar__btn--icon${overlay === "nav" ? " active" : ""}`}
              onClick={() => onOverlayChange(toggle(overlay, "nav"))}
              aria-label={t("nav.mobile.menu")}
            >
              <MenuIcon />
            </button>
          ) : null}

          <button
            type="button"
            className={`mobile-shell-bar__btn mobile-shell-bar__btn--icon${overlay === "settings-nav" ? " active" : ""}`}
            onClick={() => onOverlayChange(toggle(overlay, "settings-nav"))}
            aria-label={t("settings.nav.sectionsAria")}
          >
            <SectionsIcon />
          </button>
        </div>

        <span className="mobile-shell-bar__title">{title}</span>

        <div className="mobile-shell-bar__trailing">
          <button
            type="button"
            className="mobile-shell-bar__btn mobile-shell-bar__btn--icon mobile-shell-bar__btn--close"
            onClick={onClose}
            aria-label={t("common.closeSettings")}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-shell-bar mobile-shell-bar--chat">
      <div className="mobile-shell-bar__leading">
        <button
          type="button"
          className={`mobile-shell-bar__btn mobile-shell-bar__btn--icon${overlay === "nav" ? " active" : ""}`}
          onClick={() => onOverlayChange(toggle(overlay, "nav"))}
          aria-label={t("nav.mobile.menu")}
        >
          <MenuIcon />
        </button>

        {showList ? (
          <button
            type="button"
            className={`mobile-shell-bar__btn mobile-shell-bar__btn--icon${overlay === "list" ? " active" : ""}`}
            onClick={() => onOverlayChange(toggle(overlay, "list"))}
            aria-label={t("nav.items.chats")}
          >
            <ListIcon />
          </button>
        ) : null}
      </div>

      <span className="mobile-shell-bar__title">{title}</span>
    </div>
  );
}

/** Przyciski nawigacji w nagłówku czatu (mobile) — zamiast osobnego shell bara. */
export function MobileChatHeaderChrome({
  overlay,
  onOverlayChange,
}: {
  overlay: ShellOverlay;
  onOverlayChange: (panel: ShellOverlay) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="chat-header__mobile-chrome">
      <button
        type="button"
        className={`mobile-shell-bar__btn mobile-shell-bar__btn--icon${overlay === "nav" ? " active" : ""}`}
        onClick={() => onOverlayChange(toggle(overlay, "nav"))}
        aria-label={t("nav.mobile.menu")}
      >
        <MenuIcon />
      </button>
      <button
        type="button"
        className={`mobile-shell-bar__btn mobile-shell-bar__btn--icon${overlay === "list" ? " active" : ""}`}
        onClick={() => onOverlayChange(toggle(overlay, "list"))}
        aria-label={t("nav.items.chats")}
      >
        <ListIcon />
      </button>
    </div>
  );
}
