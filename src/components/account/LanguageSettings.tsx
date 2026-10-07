// LanguageSettings.tsx
// Wybór języka aplikacji w ustawieniach.
// Zakres:
//  - zapis profilu + i18n
//  - zapis profilu + przełączenie i18n od razu
// Nowy język: JSON + ten UI + LocaleContext.
// Przy zmianach: LocaleContext.tsx, LanguageFlag.tsx.

import { useTranslation } from "react-i18next";
import { useLocale } from "../../context/LocaleContext";
import { SUPPORTED_LOCALES, type AppLocale } from "../../languages";
import { LanguageFlag } from "./LanguageFlag";

export function LanguageSettings() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  const handlePick = (next: AppLocale) => {
    if (next !== locale) {
      void setLocale(next);
    }
  };

  return (
    <>
      <h2 className="as-section-title">{t("settings.language.title")}</h2>
      <p className="as-group-label as-group-label--language">
        {t("settings.language.chooseLanguage")}
      </p>

      <div className="as-lang-list" role="listbox" aria-label={t("settings.language.chooseLanguage")}>
        {SUPPORTED_LOCALES.map((loc) => {
          const selected = locale === loc;
          return (
            <button
              key={loc}
              type="button"
              role="option"
              aria-selected={selected}
              className={`as-lang-row${selected ? " as-lang-row--active" : ""}`}
              onClick={() => handlePick(loc)}
            >
              <LanguageFlag locale={loc} />
              <span className="as-lang-name">{t(`common.language.${loc}`)}</span>
              <span className={`as-lang-support as-lang-support--${loc === "ru" ? "poor" : "good"}`}>
                {t(`settings.language.${loc === "ru" ? "supportPoor" : "supportGood"}`)}
              </span>
              <span
                className={`as-lang-mark${selected ? " as-lang-mark--selected" : " as-lang-mark--idle"}`}
                aria-hidden="true"
              >
                {selected ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <div className="as-lang-legend">
        <span className="as-lang-legend-title">{t("settings.language.qualityLegend")}</span>
        {(["good", "medium", "poor"] as const).map(level => (
          <div key={level} className="as-lang-legend-row">
            <span className={`as-lang-support as-lang-support--${level}`}>
              {t(`settings.language.support${level[0].toUpperCase()}${level.slice(1)}`)}
            </span>
            <span>{t(`settings.language.supportDescription.${level}`)}</span>
          </div>
        ))}
      </div>
    </>
  );
}
