import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_CLOSE_MS = 220;

/**
 * Obsługa animacji zamykania modala z ochroną przed race condition:
 * opóźniony onClose nie może zamknąć modala, który został ponownie otwarty.
 */
export function useAnimatedModal(
  isOpen: boolean,
  onClose: () => void,
  options?: {
    closeDurationMs?: number;
    /** Zmiana tego klucza anuluje trwające zamykanie (np. inny użytkownik profilu). */
    resetKey?: string | number | null;
  },
) {
  const closeDurationMs = options?.closeDurationMs ?? DEFAULT_CLOSE_MS;
  const resetKey = options?.resetKey ?? null;

  const [closing, setClosing] = useState(false);
  const closeTimerRef = useRef<number>();
  const openGenerationRef = useRef(0);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current !== undefined) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = undefined;
    }
  }, []);

  const markOpen = useCallback(() => {
    openGenerationRef.current += 1;
    cancelScheduledClose();
    setClosing(false);
    document.body.style.overflow = "hidden";
  }, [cancelScheduledClose]);

  useEffect(() => {
    if (isOpen) {
      markOpen();
    }
  }, [isOpen, resetKey, markOpen]);

  useEffect(() => {
    if (!isOpen && !closing) {
      document.body.style.overflow = "";
    }
  }, [isOpen, closing]);

  useEffect(() => {
    return () => {
      cancelScheduledClose();
      document.body.style.overflow = "";
    };
  }, [cancelScheduledClose]);

  const requestClose = useCallback(() => {
    if (!isOpen || closing) return;

    const generation = openGenerationRef.current;
    setClosing(true);
    document.body.style.overflow = "";

    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = undefined;
      if (generation !== openGenerationRef.current) {
        setClosing(false);
        return;
      }
      setClosing(false);
      onClose();
    }, closeDurationMs);
  }, [isOpen, closing, onClose, closeDurationMs, cancelScheduledClose]);

  const visible = isOpen || closing;

  return { closing, visible, requestClose };
}
