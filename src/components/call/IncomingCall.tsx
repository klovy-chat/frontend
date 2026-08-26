// IncomingCall.tsx
// Modal dzwonka: odbierz/odrzuć.
// Zakres:
//  - multi-tab: tylko karta z wygranym Accept łączy LiveKit
//  - odbierz/odrzuć; dźwięk w callSound.ts
// Disable przycisków gdy claim w locie (CallContext).
// Przy zmianach: CallContext.tsx, callSound.ts.

import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { userLabel } from "../../utils/user/format";
import { useAuth } from "../../context/AuthContext";
import { useCall } from "../../context/CallContext";
import {
  startIncomingCallSound,
  stopIncomingCallSound,
} from "../../utils/media/callSound";

const C = {
  text: "var(--text)",
  textMuted: "var(--text-muted)",
};

export function IncomingCall() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { state, mode, peer, acceptCall, rejectCall, acceptInFlight } = useCall();
  const isDnd = user?.availabilityStatus === "dnd";

  useEffect(() => {
    if (state === "incoming" && !isDnd) {
      startIncomingCallSound();
      return () => stopIncomingCallSound();
    }
    stopIncomingCallSound();
  }, [state, isDnd]);

  if (state !== "incoming" || !peer) return null;

  const name = userLabel(peer);
  const modeLabel = mode === "video" ? t("call.mode.video") : t("call.mode.audio");
  const busy = acceptInFlight;

  return (
    <>
      <style>{`
        @keyframes call-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,77,255,0.45); }
          50%      { box-shadow: 0 0 0 14px rgba(124,77,255,0); }
        }
      `}</style>
      <div
        className="klovy-backdrop"
        style={{
          zIndex: 9999,
        }}
      >
        <div
          role="dialog"
          aria-label={t("call.incoming.ariaLabel")}
          className="klovy-shell"
          style={{
            width: 320,
            maxWidth: "calc(100vw - 32px)",
            padding: "28px 24px 22px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              borderRadius: "50%",
              animation: "call-pulse 1.8s ease-in-out infinite",
              marginBottom: 16,
            }}
          >
            <Avatar
              displayName={peer.displayName}
              username={peer.username}
              image={peer.image}
              color={peer.color}
              size={84}
            />
          </div>

          <div
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              color: C.text,
              textAlign: "center",
              marginBottom: 4,
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: "0.82rem",
              color: C.textMuted,
              marginBottom: 26,
            }}
          >
            {busy
              ? t("call.status.connecting")
              : t("call.status.ringing", { mode: modeLabel })}
          </div>

          <div style={{ display: "flex", gap: 36 }}>
            <button
              type="button"
              onClick={rejectCall}
              disabled={busy}
              title={t("call.controls.reject")}
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                border: "none",
                background: "#ef4444",
                color: "white",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.55 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.12s, filter 0.12s, opacity 0.12s",
              }}
              onMouseDown={(e) => {
                if (busy) return;
                e.currentTarget.style.transform = "scale(0.94)";
              }}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: "rotate(135deg)" }}>
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l1.14-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>

            <button
              type="button"
              onClick={acceptCall}
              disabled={busy}
              title={t("call.controls.accept")}
              style={{
                width: 58,
                height: 58,
                borderRadius: "50%",
                border: "none",
                background: "#22c55e",
                color: "white",
                cursor: busy ? "not-allowed" : "pointer",
                opacity: busy ? 0.55 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "transform 0.12s, opacity 0.12s",
              }}
              onMouseDown={(e) => {
                if (busy) return;
                e.currentTarget.style.transform = "scale(0.94)";
              }}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              {mode === "video" ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="23 7 16 12 23 17 23 7" />
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 6.29 6.29l1.14-.95a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
