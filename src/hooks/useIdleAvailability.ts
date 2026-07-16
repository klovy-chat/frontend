import { useEffect, useRef } from "react";
import { updateAvailabilityStatus } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { WsType } from "../api/wsProtocol";

const IDLE_MS = 5 * 60 * 1000;
const AUTO_IDLE_BRB_KEY = "klovy:autoIdleBrb";

/** Cleared on manual status picks so auto-idle BRB does not stick across sessions. */
export function clearAutoIdleBrbFlag(): void {
  try {
    sessionStorage.removeItem(AUTO_IDLE_BRB_KEY);
  } catch {
    /* private mode / blocked storage */
  }
}

function markAutoIdleBrb(userId: string): void {
  try {
    sessionStorage.setItem(AUTO_IDLE_BRB_KEY, userId);
  } catch {
    /* ignore */
  }
}

function isMarkedAutoIdleBrb(userId: string): boolean {
  try {
    return sessionStorage.getItem(AUTO_IDLE_BRB_KEY) === userId;
  } catch {
    return false;
  }
}

/**
 * While status is "online", 5 minutes without input → auto "brb".
 * Moving the cursor / typing / focusing the tab restores "online".
 * Manual away / dnd / brb are left alone.
 *
 * Auto BRB is tagged in sessionStorage so a later login/refresh does not keep
 * "zaraz wracam" as if the user had chosen it.
 */
export function useIdleAvailability(): void {
  const { user, updateUser } = useAuth();
  const ws = useWebSocket();
  const statusRef = useRef(user?.availabilityStatus ?? "online");
  statusRef.current = user?.availabilityStatus ?? "online";

  const autoIdleBrbRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const switchingRef = useRef(false);
  const restoredStaleBrbRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;

    const applyStatus = async (status: "online" | "brb") => {
      if (switchingRef.current) return;
      switchingRef.current = true;
      try {
        const updated = await updateAvailabilityStatus(status);
        updateUser(updated);
        ws?.send(WsType.SET_STATUS, { availabilityStatus: status });
      } catch {
        /* ignore transient failures */
      } finally {
        switchingRef.current = false;
      }
    };

    // Stale auto-idle from a previous tab session / logout — restore online once.
    // Skip when this tab just applied auto BRB (autoIdleBrbRef is already true).
    if (
      restoredStaleBrbRef.current !== userId &&
      !autoIdleBrbRef.current &&
      statusRef.current === "brb" &&
      isMarkedAutoIdleBrb(userId)
    ) {
      restoredStaleBrbRef.current = userId;
      clearAutoIdleBrbFlag();
      void applyStatus("online");
    }

    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = undefined;
      }
    };

    const armIdleTimer = () => {
      clearIdleTimer();
      // Only auto-idle from explicit "online". Away / DND / manual BRB stay put.
      if (statusRef.current !== "online" || autoIdleBrbRef.current) return;
      idleTimerRef.current = setTimeout(() => {
        if (statusRef.current !== "online") return;
        autoIdleBrbRef.current = true;
        markAutoIdleBrb(userId);
        void applyStatus("brb");
      }, IDLE_MS);
    };

    const onActivity = () => {
      if (autoIdleBrbRef.current && statusRef.current === "brb") {
        autoIdleBrbRef.current = false;
        clearAutoIdleBrbFlag();
        void applyStatus("online");
      }
      armIdleTimer();
    };

    // Manual status (or restore) left auto-idle — drop the in-memory flag.
    if (statusRef.current !== "brb") {
      autoIdleBrbRef.current = false;
    }
    if (statusRef.current !== "online") {
      clearIdleTimer();
    } else {
      armIdleTimer();
    }

    const opts: AddEventListenerOptions = { passive: true };
    const onVisibility = () => {
      if (document.visibilityState === "visible") onActivity();
    };

    window.addEventListener("mousemove", onActivity, opts);
    window.addEventListener("mousedown", onActivity, opts);
    window.addEventListener("keydown", onActivity, opts);
    window.addEventListener("touchstart", onActivity, opts);
    window.addEventListener("scroll", onActivity, opts);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearIdleTimer();
      window.removeEventListener("mousemove", onActivity);
      window.removeEventListener("mousedown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("touchstart", onActivity);
      window.removeEventListener("scroll", onActivity);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id, user?.availabilityStatus, ws, updateUser]);
}
