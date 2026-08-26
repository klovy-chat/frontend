// LanguageSwitcher.tsx
// Szybki PL/EN na ekranach auth.
// Zakres:
//  - bez zapisu profilu (jeszcze nie ma sesji)
//  - PL/EN przed sesją; zalogowany → LanguageSettings
// Zalogowany zmienia język w LanguageSettings.
// Przy zmianach: LocaleContext.tsx, Login.tsx.

import { useTranslation } from "react-i18next";
import { useLocale } from "../../context/LocaleContext";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type AppLocale,
} from "../../languages";

export function LanguageSwitcher() {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();

  return (
    <select
      className="al-lang-switch-select"
      value={locale}
      onChange={(e) => void setLocale(e.target.value as AppLocale)}
      aria-label={t("common.language.label")}
    >
      {SUPPORTED_LOCALES.map((code) => (
        <option key={code} value={code}>
          {LOCALE_LABELS[code]}
        </option>
      ))}
    </select>
  );
}
