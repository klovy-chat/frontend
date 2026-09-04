// LocaleContext.tsx
// Język UI + persist i PATCH profilu.
// Zakres:
//  - współpraca z i18n i formatowaniem dat
//  - persist języka + PATCH profilu gdy jest sesja
// Nowy locale: JSON tłumaczeń + ten plik + LanguageSettings.
// Przy zmianach: i18n/config.ts, languages/index.ts.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { updateLanguage } from "../api/auth";
import { changeAppLanguage } from "../i18n/config";
import {
  getFormattingLocale,
  isAppLocale,
  normalizeLocale,
  type AppLocale,
} from "../languages";
import { saveStoredLocale, readStoredLocale } from "../utils/locale/storage";
import { useAuth } from "./AuthContext";

interface LocaleContextValue {
  locale: AppLocale;
  dateLocale: string;
  setLocale: (locale: AppLocale) => Promise<void>;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { i18n } = useTranslation();
  const { user, updateUser } = useAuth();
  const [locale, setLocaleState] = useState<AppLocale>(() =>
    normalizeLocale(i18n.language),
  );

  useEffect(() => {
    const stored = readStoredLocale();
    if (stored) {
      if (stored !== locale) {
        setLocaleState(stored);
        changeAppLanguage(stored);
      }
      return;
    }

    if (user?.language && isAppLocale(user.language)) {
      setLocaleState(user.language);
      changeAppLanguage(user.language);
      saveStoredLocale(user.language);
    }
  }, [user?.language]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLocale = useCallback(
    async (next: AppLocale) => {
      const normalized = normalizeLocale(next);
      setLocaleState(normalized);
      changeAppLanguage(normalized);
      saveStoredLocale(normalized);

      if (user) {
        try {
          const updated = await updateLanguage(normalized);
          updateUser(updated);
        } catch {

        }
      }
    },
    [updateUser, user],
  );

  const value = useMemo(
    () => ({
      locale,
      dateLocale: getFormattingLocale(locale),
      setLocale,
    }),
    [locale, setLocale],
  );

  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  const { i18n } = useTranslation();

  const fallbackSetLocale = useCallback(async (next: AppLocale) => {
    const normalized = normalizeLocale(next);
    changeAppLanguage(normalized);
    saveStoredLocale(normalized);
  }, []);

  if (!ctx) {
    const locale = normalizeLocale(i18n.language);
    return {
      locale,
      dateLocale: getFormattingLocale(locale),
      setLocale: fallbackSetLocale,
    };
  }

  return ctx;
}
