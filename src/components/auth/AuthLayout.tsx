// AuthLayout.tsx
// Szablon ekranów auth (formularz + karuzela).
// Zakres:
//  - Login, Signup, Invite, setup
//  - split: formularz + karuzela; nowe publiczne strony owijaj tym
// Nowa strona publiczna: owijaj tym layoutem + auth.css.
// Przy zmianach: Carousel.tsx, auth.css.

import type { ReactNode } from "react";
import { LanguageSwitcher } from "../common/LanguageSwitcher";
import "../../styles/auth/auth.css";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="al-page">
      <div className="al-lang-switch">
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  );
}
