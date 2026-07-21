import { useTranslation } from "react-i18next";
import { useLocale } from "../../context/LocaleContext";
import {
  LOCALE_NATIVE_LABELS,
  SUPPORTED_LOCALES,
  type AppLocale,
} from "../../languages";
import { LanguageFlag } from "./LanguageFlag";

export function LanguageSettingsPanel() {
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
              <span className="as-lang-name">{LOCALE_NATIVE_LABELS[loc]}</span>
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
    </>
  );
}
