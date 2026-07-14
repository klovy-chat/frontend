import { useEffect } from "react";
import { useCall } from "../../context/CallContext";
import { IncomingCallModal } from "./IncomingCallModal";
import { CallView } from "./CallView";

/** Globalna warstwa UI rozmów: modal przychodzącego, panel aktywnego, błędy. */
export function CallOverlay() {
  const { error, clearError } = useCall();

  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(clearError, 4000);
    return () => window.clearTimeout(id);
  }, [error, clearError]);

  return (
    <>
      <IncomingCallModal />
      <CallView />
      {error && (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: 20,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-panel)",
            border: "1px solid var(--danger)",
            color: "var(--text)",
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: "0.85rem",
            boxShadow: "0 12px 30px rgba(0,0,0,0.5)",
            zIndex: 10000,
          }}
        >
          {error}
        </div>
      )}
    </>
  );
}
