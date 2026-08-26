// AuthContext.tsx
// Źródło prawdy sesji: user, login, logout, restore /me.
// Zakres:
//  - bind unread/mute do userId zanim setUser
//  - logout nie czyści kolejki hangup (Call unmount wyśle)
// Nowe pole usera z /me: typ User + ten kontekst + backend json usera.
// Przy zmianach: api/auth.ts, utils/user/restore.ts, unread.ts.

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
import { clearAutoIdleBrbFlag } from "../hooks/useIdle";
import { restoreSession, clearCachedSessionUser } from "../utils/user/restore";
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
      .then(async (info) => {
        if (cancelled) return;

        if (info?.id) {
          try {
            const unreadSync = (await import("../utils/sync/unread")).default;
            unreadSync.setUserId(info.id);
          } catch {
            /* ignore */
          }
          try {
            const mute = await import("../utils/sync/muted");
            mute.setMutedConversationsUserId(info.id);
          } catch {
            /* ignore */
          }
        }
        if (!cancelled) setUser(info);
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          void import("../utils/sync/markRead")
            .then((m) => m.clearPendingMarkReads())
            .catch(() => {});
          void import("../utils/sync/hangup")
            .then((m) => m.clearPendingHangup())
            .catch(() => {});
          void import("../utils/sync/unread")
            .then((m) => {
              m.default.resetCount({ broadcast: false });
              m.default.setUserId(null);
            })
            .catch(() => {});
          void import("../utils/sync/muted")
            .then((m) => {

              m.setMutedConversationsUserId(null);
              m.setMutedConversationKeys([], { broadcast: false, skipGuards: true });
            })
            .catch(() => {});
        }
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
      try {
        const { clearPendingMarkReads } = await import("../utils/sync/markRead");
        clearPendingMarkReads();
      } catch {/* ignore */}
      try {
        const { clearPendingHangup } = await import("../utils/sync/hangup");
        clearPendingHangup();
      } catch {/* ignore */}
      try {
        const unreadSync = (await import("../utils/sync/unread")).default;
        unreadSync.resetCount({ broadcast: false });
        unreadSync.setUserId(null);
      } catch {/* ignore */}
      try {
        const mute = await import("../utils/sync/muted");
        mute.setMutedConversationsUserId(null);
        mute.setMutedConversationKeys([], { broadcast: false, skipGuards: true });
      } catch {/* ignore */}
      const response = await authApi.login(username, password, turnstileToken);
      if (isTwoFactorLoginResponse(response)) {
        return {
          requiresTwoFactor: true,
          twoFactorToken: response.twoFactorToken,
        };
      }
      try {
        const unreadSync = (await import("../utils/sync/unread")).default;
        unreadSync.setUserId(response.user.id);
        unreadSync.resetCount({ broadcast: false });
      } catch {/* ignore */}
      try {
        const mute = await import("../utils/sync/muted");
        mute.setMutedConversationsUserId(response.user.id);
      } catch {/* ignore */}
      setUser(response.user);
      return { requiresTwoFactor: false };
    },
    [],
  );

  const completeTwoFactorLogin = useCallback(
    async (twoFactorToken: string, code: string, turnstileToken: string) => {
      try {
        const { clearPendingMarkReads } = await import("../utils/sync/markRead");
        clearPendingMarkReads();
      } catch {/* ignore */}
      try {
        const { clearPendingHangup } = await import("../utils/sync/hangup");
        clearPendingHangup();
      } catch {/* ignore */}
      try {
        const unreadSync = (await import("../utils/sync/unread")).default;
        unreadSync.resetCount({ broadcast: false });
        unreadSync.setUserId(null);
      } catch {/* ignore */}
      try {
        const mute = await import("../utils/sync/muted");
        mute.setMutedConversationsUserId(null);
        mute.setMutedConversationKeys([], { broadcast: false, skipGuards: true });
      } catch {/* ignore */}
      const { user: loggedIn } = await authApi.verifyTwoFactorLogin(
        twoFactorToken,
        code.trim(),
        turnstileToken,
      );
      try {
        const unreadSync = (await import("../utils/sync/unread")).default;
        unreadSync.setUserId(loggedIn.id);
        unreadSync.resetCount({ broadcast: false });
      } catch {/* ignore */}
      try {
        const mute = await import("../utils/sync/muted");
        mute.setMutedConversationsUserId(loggedIn.id);
      } catch {/* ignore */}
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
      clearCsrfToken();
      clearCachedSessionUser();
      clearAutoIdleBrbFlag();
      try {
        const { clearAllMentionSources } = await import("../utils/sync/mentions");
        clearAllMentionSources();
      } catch {/* ignore */}
      try {
        const mute = await import("../utils/sync/muted");
        mute.setMutedConversationsUserId(null);
        mute.setMutedConversationKeys([], { broadcast: false, skipGuards: true });
      } catch {/* ignore */}
      try {
        const unreadSync = (await import("../utils/sync/unread")).default;
        unreadSync.resetCount({ broadcast: false });
        unreadSync.setUserId(null);
      } catch {/* ignore */}

      try {
        const { setActiveConversationKey } = await import("../utils/sync/activeChat");
        setActiveConversationKey(null);
      } catch {/* ignore */}
      try {
        const { clearAllMessagePageCaches } = await import("../utils/chat/messageCache");
        clearAllMessagePageCaches();
      } catch {/* ignore */}
      try {
        const { invalidateFriendshipCache } = await import("../utils/chat/friendsCache");
        invalidateFriendshipCache();
      } catch {/* ignore */}
      try {
        const { clearPendingMarkReads } = await import("../utils/sync/markRead");
        clearPendingMarkReads();
      } catch {/* ignore */}
      try {
        const { clearPresenceSnapshot } = await import("./PresenceContext");
        clearPresenceSnapshot();
      } catch {/* ignore */}
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
