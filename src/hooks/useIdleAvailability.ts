import { useEffect, useRef } from "react";
import { updateAvailabilityStatus } from "../api/auth";
import { useAuth } from "../context/AuthContext";

const IDLE_MS = 5 * 60 * 1000;
const AUTO_IDLE_BRB_KEY = "klovy:autoIdleBrb";

/** Cleared on manual status picks so auto-idle BRB does not stick across sessions. */
export function clearAutoIdleBrbFlag(): void {
  try {
    localStorage.removeItem(AUTO_IDLE_BRB_KEY);
  } catch {
    /* private mode / blocked storage */
  }
}

function markAutoIdleBrb(userId: string): void {
  try {
    localStorage.setItem(AUTO_IDLE_BRB_KEY, userId);
  } catch {
    /* ignore */
  }
}

function isMarkedAutoIdleBrb(userId: string): boolean {
  try {
    return localStorage.getItem(AUTO_IDLE_BRB_KEY) === userId;
  } catch {
    return false;
  }
}

/**
 * While status is "online", 5 minutes without input → auto "brb".
 * Moving the cursor / typing / focusing the tab restores "online" only when
 * the BRB was applied automatically (not a manual pick).
 *
 * Auto BRB is tagged in localStorage so all tabs share the same idle state.
 */
export function useIdleAvailability(): void {
  const { user, updateUser } = useAuth();
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
        // HTTP already fans out user-status-changed — skip duplicate WS SET_STATUS.
        const updated = await updateAvailabilityStatus(status);
        updateUser(updated);
      } catch {
        /* ignore transient failures */
      } finally {
        switchingRef.current = false;
      }
    };

    // Stale auto-idle from a previous session — restore online once on load.
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

    // Sync in-memory auto-idle flag with shared storage (multi-tab / WS updates).
    if (statusRef.current === "brb" && isMarkedAutoIdleBrb(userId)) {
      autoIdleBrbRef.current = true;
    } else if (statusRef.current !== "brb") {
      autoIdleBrbRef.current = false;
    } else {
      // Manual BRB — never auto-restore on activity.
      autoIdleBrbRef.current = false;
    }

    const clearIdleTimer = () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
        idleTimerRef.current = undefined;
      }
    };

    const armIdleTimer = () => {
      clearIdleTimer();
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
  }, [user?.id, user?.availabilityStatus, updateUser]);
}
