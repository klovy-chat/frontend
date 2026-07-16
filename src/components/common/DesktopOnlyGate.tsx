import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { isMobileOrTabletDevice } from "../../utils/device/isMobileOrTablet";
import { LanguageSwitcher } from "./LanguageSwitcher";
import "../../styles/common/desktop-only.css";

interface DesktopOnlyGateProps {
  children: ReactNode;
}

export function DesktopOnlyGate({ children }: DesktopOnlyGateProps) {
  const { t } = useTranslation();
  const blocked = useMemo(() => isMobileOrTabletDevice(), []);

  if (!blocked) {
    return <>{children}</>;
  }

  return (
    <div className="desktop-only" role="status" aria-live="polite">
      <div className="desktop-only__lang">
        <LanguageSwitcher />
      </div>
      <div className="desktop-only__card">
        <h1 className="desktop-only__title">{t("desktopOnly.title")}</h1>
        <p className="desktop-only__body">{t("desktopOnly.body")}</p>
      </div>
    </div>
  );
}
