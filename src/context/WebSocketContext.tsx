// WebSocketContext.tsx
// Jedno gniazdo na powłokę zalogowanego.
// Zakres:
//  - waitBackend, connect, connected flag
//  - zamknięcie po logout (po hangup)
// Nie spinaj drugiego WS w stronie — dopisz listener na istniejącym kliencie.
// Przy zmianach: api/ws.ts, waitBackend.ts, App.tsx.

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { WebSocketClient } from "../api/ws";
import { issueWsCryptoKey } from "../api/auth";
import { WsType } from "../api/protocol";
import {
  bumpPublicMediaCache,
  bumpPublicMediaCacheForChannel,
  bumpPublicMediaCacheForUser,
} from "../utils/media/cdnVersion";
import { usesDirectBackendUrl } from "../utils/env/appEnv";
import { getBackendStartHint, waitBackend } from "../utils/env/waitBackend";
import { useAuth } from "./AuthContext";

const WebSocketContext = createContext<WebSocketClient | null>(null);
const WebSocketConnectedContext = createContext<boolean>(false);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { user, updateUser, logout, refreshUser } = useAuth();
  const [ws, setWs] = useState<WebSocketClient | null>(null);
  const [connected, setConnected] = useState(false);
  const userId = user?.id;

  const userRef = useRef(user);
  userRef.current = user;
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;
  const logoutRef = useRef(logout);
  logoutRef.current = logout;
  const refreshUserRef = useRef(refreshUser);
  refreshUserRef.current = refreshUser;

  useEffect(() => {
    if (!userId) {
      setConnected(false);
      setWs((prev) => {
        prev?.close();
        return null;
      });
      return;
    }

    let cancelled = false;
    let instance: WebSocketClient | null = null;
    const unsubs: (() => void)[] = [];

    const connect = async () => {
      if (!usesDirectBackendUrl) {
        const ready = await waitBackend();
        if (!ready) {
        if (import.meta.env.DEV) {
          console.warn(`[ws] Backend niedostępny. ${getBackendStartHint()}`);
        }
          return;
        }
      }

      if (cancelled) return;

      instance = new WebSocketClient({
        reconnectionAttempts: usesDirectBackendUrl ? Infinity : 12,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        resolveCrypto: async () => {
          try {
            const session = await issueWsCryptoKey();
            return { token: session.token, keyHex: session.key };
          } catch (err) {
            if (import.meta.env.DEV) {
              console.warn("[ws] Brak klucza szyfrującego — połączenie bez szyfrowania ramek.", err);
              return undefined;
            }
            throw err;
          }
        },
      });

      unsubs.push(
        instance.onStatusChange((status) => {
          if (!cancelled) setConnected(status === "open");
        }),
      );

      unsubs.push(
        instance.subscribe(
          WsType.PROFILE_IMAGE_UPDATED,
          (data: { userId: string; image: string | null }) => {
            bumpPublicMediaCache(data.image);
            bumpPublicMediaCacheForUser(data.userId, "avatar");
            const current = userRef.current;
            if (data.userId === userId && current) {
              updateUserRef.current({ ...current, image: data.image });
            }
          },
        ),
      );
      unsubs.push(
        instance.subscribe(
          WsType.CONTACT_AVATAR_UPDATED,
          (data: { userId: string; image: string | null }) => {
            bumpPublicMediaCache(data.image);
            bumpPublicMediaCacheForUser(data.userId, "avatar");
            const current = userRef.current;
            if (data.userId === userId && current) {
              updateUserRef.current({ ...current, image: data.image });
            }
          },
        ),
      );
      unsubs.push(
        instance.subscribe(
          WsType.PROFILE_BANNER_UPDATED,
          (data: { userId: string; banner: string | null }) => {
            bumpPublicMediaCache(data.banner);
            bumpPublicMediaCacheForUser(data.userId, "banner");
            const current = userRef.current;
            if (data.userId === userId && current) {
              updateUserRef.current({ ...current, banner: data.banner });
            }
          },
        ),
      );
      unsubs.push(
        instance.subscribe(
          WsType.CONTACT_BANNER_UPDATED,
          (data: { userId: string; banner: string | null }) => {
            bumpPublicMediaCache(data.banner);
            bumpPublicMediaCacheForUser(data.userId, "banner");
            const current = userRef.current;
            if (data.userId === userId && current) {
              updateUserRef.current({ ...current, banner: data.banner });
            }
          },
        ),
      );
      unsubs.push(
        instance.subscribe(WsType.SESSION_REVOKED, () => {

          void (async () => {
            try {
              await logoutRef.current();
            } finally {
              instance?.close();
            }
          })();
        }),
      );

      unsubs.push(
        instance.subscribe(WsType.WHITELIST_APPROVED, (data: { userId?: string }) => {
          if (data.userId === userId) {
            void refreshUserRef.current();
          }
        }),
      );

      unsubs.push(
        instance.subscribe(
          WsType.CHANNEL_AVATAR_UPDATED,
          (data: { channelId: string; image: string }) => {
            bumpPublicMediaCache(data.image);
            bumpPublicMediaCacheForChannel(data.channelId);
          },
        ),
      );

      if (!cancelled) {
        setWs(instance);
      } else {
        instance.close();
      }
    };

    void connect();

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
      instance?.close();
      setConnected(false);
      setWs((prev) => (prev === instance ? null : prev));
    };
  }, [userId]);

  return (
    <WebSocketContext.Provider value={ws}>
      <WebSocketConnectedContext.Provider value={connected}>
        {children}
      </WebSocketConnectedContext.Provider>
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export function useWebSocketConnected() {
  return useContext(WebSocketConnectedContext);
}
