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
      .then(async (info) => {
        if (cancelled) return;
        // Bind storage before setUser so Sidebar/Bridge don't race unscoped keys.
        if (info?.id) {
          try {
            const unreadSync = (await import("../utils/sync/unreadSync")).default;
            unreadSync.setUserId(info.id);
          } catch {
            /* ignore */
          }
          try {
            const mute = await import("../utils/sync/mutedConversations");
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
          void import("../utils/sync/pendingMarkRead")
            .then((m) => m.clearPendingMarkReads())
            .catch(() => {});
          void import("../utils/sync/pendingHangup")
            .then((m) => m.clearPendingHangup())
            .catch(() => {});
          void import("../utils/sync/unreadSync")
            .then((m) => {
              m.default.resetCount({ broadcast: false });
              m.default.setUserId(null);
            })
            .catch(() => {});
          void import("../utils/sync/mutedConversations")
            .then((m) => {
              // Null userId first — otherwise persistLocal([]) wipes durable mutes.
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
        const { clearPendingMarkReads } = await import("../utils/sync/pendingMarkRead");
        clearPendingMarkReads();
      } catch { /* ignore */ }
      try {
        const { clearPendingHangup } = await import("../utils/sync/pendingHangup");
        clearPendingHangup();
      } catch { /* ignore */ }
      try {
        const unreadSync = (await import("../utils/sync/unreadSync")).default;
        unreadSync.resetCount({ broadcast: false });
        unreadSync.setUserId(null);
      } catch { /* ignore */ }
      try {
        const mute = await import("../utils/sync/mutedConversations");
        mute.setMutedConversationsUserId(null);
        mute.setMutedConversationKeys([], { broadcast: false, skipGuards: true });
      } catch { /* ignore */ }
      const response = await authApi.login(username, password, turnstileToken);
      if (isTwoFactorLoginResponse(response)) {
        return {
          requiresTwoFactor: true,
          twoFactorToken: response.twoFactorToken,
        };
      }
      try {
        const unreadSync = (await import("../utils/sync/unreadSync")).default;
        unreadSync.setUserId(response.user.id);
        unreadSync.resetCount({ broadcast: false });
      } catch { /* ignore */ }
      try {
        const mute = await import("../utils/sync/mutedConversations");
        mute.setMutedConversationsUserId(response.user.id);
      } catch { /* ignore */ }
      setUser(response.user);
      return { requiresTwoFactor: false };
    },
    [],
  );

  const completeTwoFactorLogin = useCallback(
    async (twoFactorToken: string, code: string, turnstileToken: string) => {
      try {
        const { clearPendingMarkReads } = await import("../utils/sync/pendingMarkRead");
        clearPendingMarkReads();
      } catch { /* ignore */ }
      try {
        const { clearPendingHangup } = await import("../utils/sync/pendingHangup");
        clearPendingHangup();
      } catch { /* ignore */ }
      try {
        const unreadSync = (await import("../utils/sync/unreadSync")).default;
        unreadSync.resetCount({ broadcast: false });
        unreadSync.setUserId(null);
      } catch { /* ignore */ }
      try {
        const mute = await import("../utils/sync/mutedConversations");
        mute.setMutedConversationsUserId(null);
        mute.setMutedConversationKeys([], { broadcast: false, skipGuards: true });
      } catch { /* ignore */ }
      const { user: loggedIn } = await authApi.verifyTwoFactorLogin(
        twoFactorToken,
        code.trim(),
        turnstileToken,
      );
      try {
        const unreadSync = (await import("../utils/sync/unreadSync")).default;
        unreadSync.setUserId(loggedIn.id);
        unreadSync.resetCount({ broadcast: false });
      } catch { /* ignore */ }
      try {
        const mute = await import("../utils/sync/mutedConversations");
        mute.setMutedConversationsUserId(loggedIn.id);
      } catch { /* ignore */ }
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
        const { clearAllMentionSources } = await import("../utils/sync/mentionSources");
        clearAllMentionSources();
      } catch { /* ignore */ }
      try {
        const mute = await import("../utils/sync/mutedConversations");
        mute.setMutedConversationsUserId(null);
        mute.setMutedConversationKeys([], { broadcast: false, skipGuards: true });
      } catch { /* ignore */ }
      try {
        const unreadSync = (await import("../utils/sync/unreadSync")).default;
        unreadSync.resetCount({ broadcast: false });
        unreadSync.setUserId(null);
      } catch { /* ignore */ }
      // Do not clearPendingHangup here — CallContext unmount queues+sends first;
      // next shell mount flushes leftovers. Clearing here drops the peer signal.
      try {
        const { setActiveConversationKey } = await import("../utils/sync/activeConversation");
        setActiveConversationKey(null);
      } catch { /* ignore */ }
      try {
        const { clearAllMessagePageCaches } = await import("../utils/chat/messagePageCache");
        clearAllMessagePageCaches();
      } catch { /* ignore */ }
      try {
        const { invalidateFriendshipCache } = await import("../utils/chat/friendshipCache");
        invalidateFriendshipCache();
      } catch { /* ignore */ }
      try {
        const { clearPendingMarkReads } = await import("../utils/sync/pendingMarkRead");
        clearPendingMarkReads();
      } catch { /* ignore */ }
      try {
        const { clearPresenceSnapshot } = await import("./PresenceContext");
        clearPresenceSnapshot();
      } catch { /* ignore */ }
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
