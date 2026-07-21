import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { SettingsSection } from "./routes";

interface SettingsSectionMenuProps {
  section: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
  warningCount: number;
  unacknowledgedCount: number;
  onLogout: () => void;
}

const SECTION_LABEL_KEYS: Record<SettingsSection, string> = {
  konto: "settings.nav.myAccount",
  profil: "settings.nav.profile",
  sesje: "settings.nav.sessions",
  glos: "settings.nav.voice",
  jezyk: "settings.language.title",
  integracje: "settings.nav.integrations",
  ostrzezenia: "settings.nav.warnings",
};

export function SettingsSectionMenu({
  section,
  onSectionChange,
  warningCount,
  unacknowledgedCount,
  onLogout,
}: SettingsSectionMenuProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const accountSections: SettingsSection[] = ["konto", "profil", "sesje"];
  const appSections: SettingsSection[] = ["glos", "jezyk", "integracje", "ostrzezenia"];

  const pick = (next: SettingsSection) => {
    setOpen(false);
    onSectionChange(next);
  };

  return (
    <div className="settings-section-menu" ref={rootRef}>
      <button
        type="button"
        className={`settings-section-menu__trigger${open ? " active" : ""}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("settings.nav.sectionsAria")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {open ? (
        <div className="settings-section-menu__panel" role="menu">
          <p className="settings-section-menu__heading">{t("settings.title")}</p>
          <p className="settings-section-menu__label">{t("settings.nav.account")}</p>
          {accountSections.map((item) => (
            <button
              key={item}
              type="button"
              role="menuitem"
              className={`settings-section-menu__item${section === item ? " active" : ""}`}
              onClick={() => pick(item)}
            >
              {t(SECTION_LABEL_KEYS[item])}
            </button>
          ))}

          <p className="settings-section-menu__label settings-section-menu__label--spaced">
            {t("settings.nav.app")}
          </p>
          {appSections.map((item) => (
            <button
              key={item}
              type="button"
              role="menuitem"
              className={`settings-section-menu__item${section === item ? " active" : ""}`}
              onClick={() => pick(item)}
            >
              <span>{t(SECTION_LABEL_KEYS[item])}</span>
              {item === "ostrzezenia" && warningCount > 0 ? (
                <span
                  className={`as-nav-count${unacknowledgedCount > 0 ? " as-nav-count--alert" : ""}`}
                >
                  {warningCount}
                </span>
              ) : null}
            </button>
          ))}

          <div className="settings-section-menu__divider" />
          <button
            type="button"
            role="menuitem"
            className="settings-section-menu__item settings-section-menu__item--danger"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            {t("settings.nav.logout")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
