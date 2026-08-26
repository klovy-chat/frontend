// DesktopOnly.tsx
// Bramka: web tylko desktop; telefon widzi komunikat.
// Zakres:
//  - isMobileBlock; Tauri przechodzi
//  - web na telefonie = komunikat; Tauri przechodzi
// Tekst / CTA: i18n + desktop.css.
// Przy zmianach: useMobileBlock.ts, main.tsx.

import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useMobileBlock } from "../../hooks/useMobileBlock";
import "../../styles/auth/auth.css";
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
    <div className="desktop-only">
      <div className="desktop-only__lang">
        <LanguageSwitcher />
      </div>
      <div className="desktop-only__content">
        <h1 className="desktop-only__title">{t("desktopOnly.title")}</h1>
        <p className="desktop-only__body">{t("desktopOnly.body")}</p>
      </div>
    </div>
  );
}
