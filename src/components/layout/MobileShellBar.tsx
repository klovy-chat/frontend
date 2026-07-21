import { useTranslation } from "react-i18next";

export type ShellOverlay = "nav" | "list" | "settings-nav" | null;

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
        {showAppNav ? (
          <button
            type="button"
            className={`mobile-shell-bar__btn${overlay === "nav" ? " active" : ""}`}
            onClick={() => onOverlayChange(toggle(overlay, "nav"))}
            aria-label={t("nav.mobile.menu")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        ) : null}

        <button
          type="button"
          className={`mobile-shell-bar__btn${overlay === "settings-nav" ? " active" : ""}`}
          onClick={() => onOverlayChange(toggle(overlay, "settings-nav"))}
          aria-label={t("settings.nav.sectionsAria")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
          </svg>
          {t("nav.mobile.sections")}
        </button>

        <span className="mobile-shell-bar__title">{title}</span>

        <button
          type="button"
          className="mobile-shell-bar__btn mobile-shell-bar__btn--close"
          onClick={onClose}
          aria-label={t("common.closeSettings")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="mobile-shell-bar mobile-shell-bar--chat">
      <button
        type="button"
        className={`mobile-shell-bar__btn${overlay === "nav" ? " active" : ""}`}
        onClick={() => onOverlayChange(toggle(overlay, "nav"))}
        aria-label={t("nav.mobile.menu")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {showList && (
        <button
          type="button"
          className={`mobile-shell-bar__btn${overlay === "list" ? " active" : ""}`}
          onClick={() => onOverlayChange(toggle(overlay, "list"))}
          aria-label={t("nav.items.chats")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {t("nav.items.chats")}
        </button>
      )}

      <span className="mobile-shell-bar__title">{title}</span>
    </div>
  );
}
