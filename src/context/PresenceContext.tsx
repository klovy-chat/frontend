// PresenceContext.tsx
// Techniczna obecność online/offline i czas ostatniej aktywności.
// Zakres:
//  - seed HTTP, delty WS
//  - usePresenceSeed bez re-renderu, useUserPresence z subskrypcją
//  - seed pomija obiekty bez boolean isOnline (slim channel JSON)
// Po logout wyczyść snapshot, inaczej zostaną kropki poprzedniego konta.
// Przy zmianach: Sidebar.tsx, ChatWindow.tsx, user/online.rs.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "./AuthContext";
import { useWebSocket, useWebSocketConnected } from "./WebSocketContext";
import { WsType } from "../api/protocol";
import { getContactsForList } from "../api/contacts";

export interface Presence {
  isOnline?: boolean;
  lastSeen?: string | null;
}

type PresenceMap = Record<string, Presence>;

let presenceSnapshot: PresenceMap = {};
const userListeners = new Map<string, Set<() => void>>();

function emitPresence(userId?: string) {
  if (userId) {
    userListeners.get(userId)?.forEach((l) => l());
  }
}

function setPresenceMap(updater: (prev: PresenceMap) => PresenceMap) {
  const next = updater(presenceSnapshot);
  if (next === presenceSnapshot) return;
  const prev = presenceSnapshot;
  presenceSnapshot = next;
  const changedIds = new Set<string>();
  for (const id of Object.keys(next)) {
    if (prev[id] !== next[id]) changedIds.add(id);
  }
  for (const id of Object.keys(prev)) {
    if (!(id in next)) changedIds.add(id);
  }
  for (const id of changedIds) emitPresence(id);
  if (changedIds.size === 0) emitPresence();
}

export function clearPresenceSnapshot() {
  if (Object.keys(presenceSnapshot).length === 0) return;
  presenceSnapshot = {};
  userListeners.forEach((set) => set.forEach((l) => l()));
}

interface PresenceApi {

  seed: (
    users: Array<{
      _id?: string;
      id?: string;
      isOnline?: boolean;
      lastSeen?: string | null;
    }>,
  ) => void;
}

const PresenceApiContext = createContext<PresenceApi | null>(null);
const PRESENCE_RECONCILIATION_INTERVAL_MS = 30_000;

interface StatusChangedPayload {
  userId: string;
  status: {
    isOnline: boolean;
    lastSeen?: string | number | null;
  };
}

export function PresenceProvider({ children }: { children: ReactNode }) {
  const ws = useWebSocket();
  const wsConnected = useWebSocketConnected();
  const { user } = useAuth();
  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;
  const wasConnectedRef = useRef(wsConnected);
  const disconnectOfflineTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!user?.id) {
      clearPresenceSnapshot();
      return;
    }

    if (userIdRef.current && userIdRef.current !== user.id) {
      clearPresenceSnapshot();
    }
  }, [user?.id]);

  useEffect(() => {
    const was = wasConnectedRef.current;
    wasConnectedRef.current = wsConnected;

    if (disconnectOfflineTimerRef.current) {
      clearTimeout(disconnectOfflineTimerRef.current);
      disconnectOfflineTimerRef.current = undefined;
    }
    if (!was || wsConnected) return;
    disconnectOfflineTimerRef.current = setTimeout(() => {
      disconnectOfflineTimerRef.current = undefined;
      if (wasConnectedRef.current) return;
      setPresenceMap((prev) => {
        const next: PresenceMap = {};
        let changed = false;
        for (const [id, p] of Object.entries(prev)) {
          if (p.isOnline) {
            next[id] = { ...p, isOnline: false };
            changed = true;
          } else {
            next[id] = p;
          }
        }
        return changed ? next : prev;
      });
    }, 2_500);
    return () => {
      if (disconnectOfflineTimerRef.current) {
        clearTimeout(disconnectOfflineTimerRef.current);
        disconnectOfflineTimerRef.current = undefined;
      }
    };
  }, [wsConnected]);

  useEffect(() => {
    if (!ws) return;
    const onStatusChanged = (payload: StatusChangedPayload) => {
      if (!payload?.userId) return;
      setPresenceMap((prev) => {
        const previous = prev[payload.userId] ?? {};
        return {
          ...prev,
          [payload.userId]: {
            isOnline: payload.status.isOnline,
            lastSeen:
              payload.status.lastSeen != null
                ? new Date(payload.status.lastSeen).toISOString()
                : previous.lastSeen ?? null,
          },
        };
      });

    };
    const unsub = ws.subscribe(WsType.USER_STATUS_CHANGED, onStatusChanged);
    const unsubFriend = ws.subscribe(
      WsType.FRIENDSHIP_REMOVED,
      (e: { userId?: string }) => {
        const id = e.userId?.trim();
        if (!id) return;
        setPresenceMap((prev) => {
          if (!(id in prev)) return prev;
          const next = { ...prev };
          delete next[id];
          return next;
        });
      },
    );
    return () => {
      unsub();
      unsubFriend();
    };
  }, [ws]);

  const seed = useCallback(
    (
      users: Array<{
        _id?: string;
        id?: string;
        isOnline?: boolean;
        lastSeen?: string | null;
      }>,
    ) => {
      setPresenceMap((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const u of users) {
          const id = u._id ?? u.id;
          if (!id) continue;
          // Channel admin/members (i inne slim JSON) nie mają isOnline —
          // nie nadpisuj live WS statusu „dziurawym” obiektem (wygląda jak offline).
          if (typeof u.isOnline !== "boolean") continue;
          const incoming = {
            isOnline: u.isOnline,
            lastSeen: u.lastSeen ?? prev[id]?.lastSeen ?? null,
          };
          const prevEntry = next[id];
          if (
            prevEntry &&
            prevEntry.isOnline === incoming.isOnline &&
            prevEntry.lastSeen === incoming.lastSeen
          ) {
            continue;
          }

          if (prevEntry?.isOnline === true && incoming.isOnline === true) {

            next[id] = {
              isOnline: true,
              lastSeen: incoming.lastSeen ?? prevEntry.lastSeen,
            };
            changed =
              changed ||
              prevEntry.lastSeen !== next[id].lastSeen;
            continue;
          }
          next[id] = incoming;
          changed = true;
        }
        return changed ? next : prev;
      });
    },
    [],
  );

  useEffect(() => {
    if (!user?.id || !wsConnected) return;

    let cancelled = false;
    const reconcile = async () => {
      try {
        const result = await getContactsForList();
        if (!cancelled) seed(result.contacts);
      } catch (error) {
        console.error("Failed to reconcile presence", error);
      }
    };

    void reconcile();
    const interval = window.setInterval(() => {
      void reconcile();
    }, PRESENCE_RECONCILIATION_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user?.id, wsConnected, seed]);

  const api = useMemo(() => ({ seed }), [seed]);

  return (
    <PresenceApiContext.Provider value={api}>
      {children}
    </PresenceApiContext.Provider>
  );
}

export function usePresenceSeed(): PresenceApi["seed"] {
  return useContext(PresenceApiContext)?.seed ?? (() => {});
}

export function useUserPresence(userId: string | undefined): Presence | undefined {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (!userId) return () => {};
      let set = userListeners.get(userId);
      if (!set) {
        set = new Set();
        userListeners.set(userId, set);
      }
      set.add(onStoreChange);
      return () => {
        set!.delete(onStoreChange);
        if (set!.size === 0) userListeners.delete(userId);
      };
    },
    () => (userId ? presenceSnapshot[userId] : undefined),
    () => undefined,
  );
}

export function getPresenceSnapshot(userId: string | undefined): Presence | undefined {
  return userId ? presenceSnapshot[userId] : undefined;
}
