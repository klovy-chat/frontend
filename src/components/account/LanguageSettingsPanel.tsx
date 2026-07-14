import { useTranslation } from "react-i18next";
import { useLocale } from "../../context/LocaleContext";
import { SUPPORTED_LOCALES, type AppLocale } from "../../languages";

export function LanguageSettingsPanel() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  const handleChange = (value: string) => {
    const next = value as AppLocale;
    if (next !== locale) {
      void setLocale(next);
    }
  };

  return (
    <>
      <h2 className="as-section-title">{t("common.language.panelTitle")}</h2>
      <p className="as-section-subtitle">{t("common.language.panelHint")}</p>

      <div className="as-card">
        <div className="as-field">
          <label htmlFor="app-language">{t("common.language.label")}</label>
          <select
            id="app-language"
            className="as-select"
            value={locale}
            onChange={(e) => handleChange(e.target.value)}
          >
            {SUPPORTED_LOCALES.map((loc) => (
              <option key={loc} value={loc}>
                {t(`common.language.${loc}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
    </>
  );
}
