import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useWebSocket } from "./WebSocketContext";
import { WsType } from "../api/wsProtocol";

export type AvailabilityStatus = "online" | "away" | "brb" | "dnd";

export interface Presence {
  isOnline?: boolean;
  availabilityStatus?: AvailabilityStatus;
  lastSeen?: string | null;
}

interface PresenceContextValue {
  presence: Record<string, Presence>;
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

const PresenceContext = createContext<PresenceContextValue | null>(null);

interface StatusChangedPayload {
  userId: string;
  status: {
    isOnline: boolean;
    lastSeen?: string | number | null;
    availabilityStatus?: AvailabilityStatus;
  };
}

/**
 * Central, WebSocket-driven presence store. Every consumer (sidebar, contacts
 * modal, chat header, profile modals) reads from the same map so online/offline
 * and availability status update instantly and consistently everywhere.
 */
export function PresenceProvider({ children }: { children: ReactNode }) {
  const ws = useWebSocket();
  const [presence, setPresence] = useState<Record<string, Presence>>({});

  useEffect(() => {
    if (!ws) return;
    const onStatusChanged = (payload: StatusChangedPayload) => {
      if (!payload?.userId) return;
      setPresence((prev) => {
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
    };
    const unsub = ws.subscribe(WsType.USER_STATUS_CHANGED, onStatusChanged);
    return () => unsub();
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
      setPresence((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const u of users) {
          const id = u._id ?? u.id;
          if (!id) continue;
          // Do not overwrite fresher live data if we already have it.
          if (next[id]) continue;
          next[id] = {
            isOnline: u.isOnline,
            availabilityStatus:
              (u.availabilityStatus as AvailabilityStatus | undefined) ??
              "online",
            lastSeen: u.lastSeen ?? null,
          };
          changed = true;
        }
        return changed ? next : prev;
      });
    },
    [],
  );

  const value = useMemo(() => ({ presence, seed }), [presence, seed]);

  return (
    <PresenceContext.Provider value={value}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresenceStore(): PresenceContextValue {
  return (
    useContext(PresenceContext) ?? {
      presence: {},
      seed: () => {},
    }
  );
}

/**
 * Returns a user-like object merged with the latest live presence, so callers
 * can render `isOnline` / `availabilityStatus` without wiring WS themselves.
 */
export function useResolvePresence() {
  const { presence } = usePresenceStore();
  const presenceRef = useRef(presence);
  presenceRef.current = presence;
  return useCallback(
    <T extends { _id?: string; id?: string }>(user: T): T & Presence => {
      const id = user._id ?? user.id;
      const live = id ? presence[id] : undefined;
      if (!live) return user as T & Presence;
      return { ...user, ...live };
    },
    [presence],
  );
}
