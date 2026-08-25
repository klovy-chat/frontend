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
import { WsType } from "../api/wsProtocol";
import type { User } from "../types";

export type AvailabilityStatus = "online" | "away" | "brb" | "dnd";

export interface Presence {
  isOnline?: boolean;
  availabilityStatus?: AvailabilityStatus;
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

/** Drop module snapshot on logout / account switch. */
export function clearPresenceSnapshot() {
  if (Object.keys(presenceSnapshot).length === 0) return;
  presenceSnapshot = {};
  userListeners.forEach((set) => set.forEach((l) => l()));
}

interface PresenceApi {
  /** Seed presence from an HTTP snapshot (e.g. contacts/friends list). */
  seed: (
    users: Array<{
      _id?: string;
      id?: string;
      isOnline?: boolean;
      availabilityStatus?: string | null;
      lastSeen?: string | null;
    }>,
  ) => void;
}

const PresenceApiContext = createContext<PresenceApi | null>(null);

interface StatusChangedPayload {
  userId: string;
  status: {
    isOnline: boolean;
    lastSeen?: string | number | null;
    availabilityStatus?: AvailabilityStatus;
  };
}

/**
 * Central, WebSocket-driven presence store. Consumers that only need `seed`
 * do not re-render on status changes; `useUserPresence(id)` re-renders only
 * when that user's presence changes.
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const ws = useWebSocket();
  const wsConnected = useWebSocketConnected();
  const { user, updateUser } = useAuth();
  const userIdRef = useRef(user?.id);
  const userRef = useRef(user);
  userIdRef.current = user?.id;
  userRef.current = user;
  const updateUserRef = useRef(updateUser);
  updateUserRef.current = updateUser;
  const wasConnectedRef = useRef(wsConnected);
  const disconnectOfflineTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const was = wasConnectedRef.current;
    wasConnectedRef.current = wsConnected;
    // Keep last presence across short WS blips — only force offline after a
    // short delay, and cancel if we reconnect (seeds/WS will refresh).
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
            availabilityStatus:
              payload.status.availabilityStatus ??
              previous.availabilityStatus ??
              "online",
            lastSeen:
              payload.status.lastSeen != null
                ? new Date(payload.status.lastSeen).toISOString()
                : previous.lastSeen ?? null,
          },
        };
      });

      if (
        payload.userId === userIdRef.current &&
        payload.status.availabilityStatus
      ) {
        const current = userRef.current;
        if (current) {
          updateUserRef.current({
            ...current,
            availabilityStatus: payload.status.availabilityStatus,
          } satisfies User);
        }
      }
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
        availabilityStatus?: string | null;
        lastSeen?: string | null;
      }>,
    ) => {
      setPresenceMap((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const u of users) {
          const id = u._id ?? u.id;
          if (!id) continue;
          const incoming = {
            isOnline: u.isOnline,
            availabilityStatus:
              (u.availabilityStatus as AvailabilityStatus | undefined) ??
              "online",
            lastSeen: u.lastSeen ?? null,
          };
          const prevEntry = next[id];
          if (
            prevEntry &&
            prevEntry.isOnline === incoming.isOnline &&
            prevEntry.availabilityStatus === incoming.availabilityStatus &&
            prevEntry.lastSeen === incoming.lastSeen
          ) {
            continue;
          }
          // Don't let a stale HTTP seed downgrade a live WS online presence,
          // and keep live availability while both sides report online.
          if (prevEntry?.isOnline === true && incoming.isOnline === false) {
            next[id] = {
              isOnline: true,
              availabilityStatus: prevEntry.availabilityStatus,
              lastSeen: incoming.lastSeen ?? prevEntry.lastSeen,
            };
            changed = true;
            continue;
          }
          if (prevEntry?.isOnline === true && incoming.isOnline === true) {
            // Prefer HTTP availability when both report online (missed WS flip).
            next[id] = {
              isOnline: true,
              availabilityStatus:
                incoming.availabilityStatus ?? prevEntry.availabilityStatus,
              lastSeen: incoming.lastSeen ?? prevEntry.lastSeen,
            };
            changed =
              changed ||
              prevEntry.lastSeen !== next[id].lastSeen ||
              prevEntry.availabilityStatus !== next[id].availabilityStatus;
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

  const api = useMemo(() => ({ seed }), [seed]);

  return (
    <PresenceApiContext.Provider value={api}>
      {children}
    </PresenceApiContext.Provider>
  );
}

/** Seed-only hook — no re-render on status updates. */
export function usePresenceSeed(): PresenceApi["seed"] {
  return useContext(PresenceApiContext)?.seed ?? (() => {});
}

/** Subscribe to a single user's presence. */
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

/** Non-reactive snapshot for one-off reads (context menus, etc.). */
export function getPresenceSnapshot(userId: string | undefined): Presence | undefined {
  return userId ? presenceSnapshot[userId] : undefined;
}
