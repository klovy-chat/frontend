// useIdle.ts
// Auto-BRB po bezczynności; ręczne BRB zostaje.
// Zakres:
//  - status idzie HTTP — nie duplikuj SET_STATUS na WS
//  - auto-BRB po bezczynności; status idzie HTTP, nie WS
// Progi czasu tylko tutaj.
// Przy zmianach: App.tsx, api/auth.ts.

import { useEffect, useRef } from "react";
import { updateAvailabilityStatus } from "../api/auth";
import { useAuth } from "../context/AuthContext";

const IDLE_MS = 5 * 60 * 1000;
const AUTO_IDLE_BRB_KEY = "klovy:autoIdleBrb";

export function clearAutoIdleBrbFlag(): void {
  try {
    localStorage.removeItem(AUTO_IDLE_BRB_KEY);
  } catch {

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

export function useIdle(): void {
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

        const updated = await updateAvailabilityStatus(status);
        updateUser(updated);
      } catch {

      } finally {
        switchingRef.current = false;
      }
    };

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

    if (statusRef.current === "brb" && isMarkedAutoIdleBrb(userId)) {
      autoIdleBrbRef.current = true;
    } else if (statusRef.current !== "brb") {
      autoIdleBrbRef.current = false;
    } else {

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
