import { useEffect, useRef } from "react";
import { updateAvailabilityStatus } from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useWebSocket } from "../context/WebSocketContext";
import { WsType } from "../api/wsProtocol";

const IDLE_MS = 5 * 60 * 1000;

/**
 * While status is "online", 5 minutes without input → auto "brb".
 * Moving the cursor / typing / focusing the tab restores "online".
 * Manual away / dnd / brb are left alone.
 */
export function useIdleAvailability(): void {
  const { user, updateUser } = useAuth();
  const ws = useWebSocket();
  const statusRef = useRef(user?.availabilityStatus ?? "online");
  statusRef.current = user?.availabilityStatus ?? "online";

  const autoIdleBrbRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const switchingRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;

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
        void applyStatus("brb");
      }, IDLE_MS);
    };

    const onActivity = () => {
      if (autoIdleBrbRef.current && statusRef.current === "brb") {
        autoIdleBrbRef.current = false;
        void applyStatus("online");
      }
      armIdleTimer();
    };

    // If the user manually picks another status, forget the idle auto-flag.
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
