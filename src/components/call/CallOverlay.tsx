import { useEffect, useRef } from "react";
import { useCall } from "../../context/CallContext";
import { useToast } from "../../context/ToastContext";
import { IncomingCallModal } from "./IncomingCallModal";
import { CallView } from "./CallView";

/** Globalna warstwa UI rozmów: modal przychodzącego + panel aktywnego. */
export function CallOverlay() {
  const { error, clearError } = useCall();
  const toast = useToast();
  const lastErrorRef = useRef<string | null>(null);

  useEffect(() => {
    if (!error || error === lastErrorRef.current) return;
    lastErrorRef.current = error;
    toast.error(error);
    clearError();
  }, [error, clearError, toast]);

  return (
    <>
      <IncomingCallModal />
      <CallView />
    </>
  );
}
