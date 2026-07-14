import type { ReactNode } from "react";
import { LanguageSwitcher } from "../common/LanguageSwitcher";
import "../../styles/auth/auth.css";

interface AuthPageLayoutProps {
  children: ReactNode;
}

export function AuthPageLayout({ children }: AuthPageLayoutProps) {
  return (
    <div className="al-page">
      <div className="al-lang-switch">
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  );
}
