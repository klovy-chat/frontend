// CallOverlay.tsx
// Globalna warstwa IncomingCall + CallView (nie zależy od / vs /settings).
// Zakres:
//  - montowana w AuthenticatedShell
//  - IncomingCall + CallView nad całą powłoką (i Settings)
// Nie wkładaj tego tylko do Chat.tsx — zniknie w ustawieniach.
// Przy zmianach: App.tsx, CallContext.tsx.

import { useEffect, useRef } from "react";
import { useCall } from "../../context/CallContext";
import { useToast } from "../../context/ToastContext";
import { IncomingCall } from "./IncomingCall";
import { CallView } from "./CallView";

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
      <IncomingCall />
      <CallView />
    </>
  );
}
