import "./AppearanceSettings.css";

import { Check, Type } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useTheme, type Theme } from "../../context/ThemeContext";

interface ThemeOption {
  id: Theme;
}

const THEME_OPTIONS: ThemeOption[] = [
  { id: "dark" },
  { id: "light" },
  { id: "black" },
  //{ id: "blue" },
  { id: "forest" },
  //{ id: "desert" },
];

export function AppearanceSettings() {
  const { t } = useTranslation();
  const { theme, setTheme, messageTextSize, setMessageTextSize } = useTheme();

  return (
    <>
      <h2 className="as-section-title">
        {t("settings.appearance.title")}
      </h2>

      <p className="as-section-subtitle">
        {t("settings.appearance.subtitle")}
      </p>

      <div className="appearance-section">
        <p className="appearance-section-label">
          {t("settings.appearance.theme")}
        </p>

        <div className="appearance-theme-grid">
          {THEME_OPTIONS.filter(option => option.id !== "forest").map((option) => {
            const active = theme === option.id;

            return (
              <button
                key={option.id}
                type="button"
                className={`appearance-theme-card${active ? " active" : ""}`}
                onClick={() => setTheme(option.id)}
                aria-pressed={active}
              >
                <div className={`appearance-theme-preview appearance-theme-preview--${option.id}`}>
                  <div className="appearance-theme-preview-sidebar" />

                  <div className="appearance-theme-preview-content">
                    <div className="appearance-theme-preview-message accent" />
                    <div className="appearance-theme-preview-message" />
                    <div className="appearance-theme-preview-message short" />
                  </div>
                </div>

                <div className="appearance-theme-info">
                  <div>
                    <strong>
                      {t(`settings.appearance.themes.${option.id}.name`)}
                    </strong>


                  </div>

                  <span
                    className={`appearance-theme-radio${active ? " active" : ""}`}
                    aria-hidden="true"
                  >{active && <Check size={10} />}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="appearance-section">
        <p className="appearance-section-label">{t("settings.appearance.textSize.section")}</p>
        <div className="appearance-text-size-row">
          <span className="appearance-text-size-icon"><Type size={18} /></span>
          <div className="appearance-text-size-copy"><strong>{t("settings.appearance.textSize.title")}</strong><span>{t(`settings.appearance.textSize.${messageTextSize}`)}</span></div>
          <div className="appearance-text-size-options" role="group" aria-label={t("settings.appearance.textSize.title")}>
            {(["s", "m", "l"] as const).map(size => <button key={size} type="button" className={messageTextSize === size ? "active" : ""} aria-pressed={messageTextSize === size} aria-label={t(`settings.appearance.textSize.${size}`)} onClick={() => setMessageTextSize(size)}>{size.toUpperCase()}</button>)}
          </div>
        </div>
      </div>
    </>
  );
}
