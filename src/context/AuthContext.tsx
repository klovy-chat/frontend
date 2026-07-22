import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import * as authApi from "../api/auth";
import { isTwoFactorLoginResponse } from "../api/auth";
import { ApiError, clearCsrfToken } from "../api/client";
import { e2eService } from "../crypto/e2e/e2eService";
import { clearAutoIdleBrbFlag } from "../hooks/useIdleAvailability";
import { restoreSession, clearCachedSessionUser } from "../utils/user/sessionRestore";
import type { User } from "../types";

export interface LoginResult {
  requiresTwoFactor: boolean;
  twoFactorToken?: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (
    username: string,
    password: string,
    turnstileToken: string,
  ) => Promise<LoginResult>;
  completeTwoFactorLogin: (
    twoFactorToken: string,
    code: string,
    turnstileToken: string,
  ) => Promise<void>;
  signup: (
    username: string,
    password: string,
    turnstileToken: string,
    language?: string,
  ) => Promise<string | undefined>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const info = await restoreSession(true);
    setUser(info);
  }, []);

  useEffect(() => {
    let cancelled = false;

    restoreSession()
      .then((info) => {
        if (!cancelled) setUser(info);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (
      username: string,
      password: string,
      turnstileToken: string,
    ): Promise<LoginResult> => {
      const response = await authApi.login(username, password, turnstileToken);
      if (isTwoFactorLoginResponse(response)) {
        return {
          requiresTwoFactor: true,
          twoFactorToken: response.twoFactorToken,
        };
      }
      setUser(response.user);
      return { requiresTwoFactor: false };
    },
    [],
  );

  const completeTwoFactorLogin = useCallback(
    async (twoFactorToken: string, code: string, turnstileToken: string) => {
      const { user: loggedIn } = await authApi.verifyTwoFactorLogin(
        twoFactorToken,
        code.trim(),
        turnstileToken,
      );
      setUser(loggedIn);
    },
    [],
  );

  const signup = useCallback(
    async (
      username: string,
      password: string,
      turnstileToken: string,
      language?: string,
    ) => {
      const result = await authApi.signup(
        username,
        password,
        turnstileToken,
        language,
      );
      return result.message;
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) throw err;
    } finally {
      await e2eService.clearLocalKeysOnLogout();
      clearCsrfToken();
      clearCachedSessionUser();
      clearAutoIdleBrbFlag();
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    let lastCheckAt = 0;
    const MIN_CHECK_INTERVAL_MS = 60_000;

    const verifySession = async () => {
      if (cancelled || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastCheckAt < MIN_CHECK_INTERVAL_MS) return;
      lastCheckAt = now;
      try {
        const info = await restoreSession(true);
        if (info && !cancelled) {
          setUser(info);
        }
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          await logout();
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void verifySession();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    const intervalId = globalThis.setInterval(() => {
      void verifySession();
    }, 5 * 60_000);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      globalThis.clearInterval(intervalId);
    };
  }, [user?.id, logout]);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      completeTwoFactorLogin,
      signup,
      logout,
      refreshUser,
      updateUser: setUser,
    }),
    [user, loading, login, completeTwoFactorLogin, signup, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
