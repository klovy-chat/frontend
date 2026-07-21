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
  DEFAULT_LOCALE,
  getFormattingLocale,
  isAppLocale,
  normalizeLocale,
  type AppLocale,
} from "../languages";
import { saveStoredLocale } from "../utils/locale/localeStorage";
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
    if (user?.language && isAppLocale(user.language)) {
      const profileLocale = user.language;
      if (profileLocale !== locale) {
        setLocaleState(profileLocale);
        changeAppLanguage(profileLocale);
        saveStoredLocale(profileLocale);
      }
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
          // local preference still applied
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
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      dateLocale: getFormattingLocale(DEFAULT_LOCALE),
      setLocale: async (next: AppLocale) => {
        changeAppLanguage(next);
        saveStoredLocale(next);
      },
    };
  }
  return ctx;
}
