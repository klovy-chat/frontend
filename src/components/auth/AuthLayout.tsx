// AuthLayout.tsx
// Wspólny layout ekranów auth (formularz, motyw i język).
// Zakres:
//  - Login, Signup, Invite, setup
//  - jednokolumnowy formularz na wspólnym tle; nowe publiczne strony owijaj tym
// Nowa strona publiczna: owijaj tym layoutem + auth.css.
// Przy zmianach: auth.css.

import type { ReactNode } from "react";
import { Moon, Sun } from "lucide-react";
import { LanguageSwitcher } from "../common/LanguageSwitcher";
import { useTheme } from "../../context/ThemeContext";
import "../../styles/auth/auth.css";

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="al-page">
      <div className="al-page-actions">
        <button
          type="button"
          className="al-theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Light theme" : "Dark theme"}
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <LanguageSwitcher />
      </div>
      {children}
    </div>
  );
}
