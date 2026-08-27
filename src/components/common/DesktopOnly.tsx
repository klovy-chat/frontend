// DesktopOnly.tsx
// Bramka: web na telefonie = komunikat o wersji mobilnej.
// Zakres:
//  - isMobileBlock; Tauri przechodzi
//  - karta jak auth (logo, shell), nie goły tekst
// Tekst / CTA: i18n + desktop.css.
// Przy zmianach: useMobileBlock.ts, languages/*.json, desktop.css.

import { type ReactNode } from "react";
import { Smartphone, Store } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AuthLayout } from "../auth/AuthLayout";
import { LOGO_COLOUR_URL } from "../../constants/branding";
import { useMobileBlock } from "../../hooks/useMobileBlock";
import "../../styles/common/desktop.css";

interface DesktopOnlyProps {
  children: ReactNode;
}

export function DesktopOnly({ children }: DesktopOnlyProps) {
  const { t } = useTranslation();
  const blocked = useMobileBlock();

  if (!blocked) {
    return <>{children}</>;
  }

  return (
    <div className="desktop-only-page">
      <AuthLayout>
        <div className="al-card al-card--solo desktop-only-card">
          <div className="al-left">
            <div className="al-brand">
              <div className="al-logo">
                <img src={LOGO_COLOUR_URL} alt="" />
              </div>
              <div>
                <strong>Klovy Chat</strong>
                <span>{t("auth.brand.tagline")}</span>
              </div>
            </div>

            <p className="desktop-only__badge">{t("desktopOnly.badge")}</p>
            <h1 className="al-title desktop-only__title">{t("desktopOnly.title")}</h1>
            <p className="desktop-only__body">{t("desktopOnly.body")}</p>

            <ul className="desktop-only__steps">
              <li className="desktop-only__step">
                <span className="desktop-only__step-icon" aria-hidden="true">
                  <Smartphone size={18} strokeWidth={2} />
                </span>
                <div>
                  <p className="desktop-only__step-title">{t("desktopOnly.browserTitle")}</p>
                  <p className="desktop-only__step-body">{t("desktopOnly.browserBody")}</p>
                </div>
              </li>
              <li className="desktop-only__step">
                <span className="desktop-only__step-icon" aria-hidden="true">
                  <Store size={18} strokeWidth={2} />
                </span>
                <div>
                  <p className="desktop-only__step-title">{t("desktopOnly.storesTitle")}</p>
                  <p className="desktop-only__step-body">{t("desktopOnly.storesBody")}</p>
                </div>
              </li>
            </ul>

            <p className="desktop-only__hint">{t("desktopOnly.hint")}</p>
          </div>
        </div>
      </AuthLayout>
    </div>
  );
}
