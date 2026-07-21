import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useMobileOrTabletBlock } from "../../hooks/useMobileOrTabletBlock";
import "../../styles/auth/auth.css";
import "../../styles/common/desktop-only.css";

interface DesktopOnlyGateProps {
  children: ReactNode;
}

export function DesktopOnlyGate({ children }: DesktopOnlyGateProps) {
  const { t } = useTranslation();
  const blocked = useMobileOrTabletBlock();

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
