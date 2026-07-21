import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AuthPageLayout } from "../auth/AuthPageLayout";
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
    <AuthPageLayout>
      <div className="al-card al-card--solo desktop-only-card" role="status" aria-live="polite">
        <div className="al-left desktop-only-card__content">
          <div className="desktop-only-card__icon" aria-hidden="true">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h1 className="al-title desktop-only-card__title">{t("desktopOnly.title")}</h1>
          <p className="al-subtitle desktop-only-card__body">{t("desktopOnly.body")}</p>
        </div>
      </div>
    </AuthPageLayout>
  );
}
