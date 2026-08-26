// useModal.ts
// Animowane zamykanie overlay (generation, żeby stary timer nie wygrał).
// Zakres:
//  - resetKey anuluje close gdy zmienia się obiekt (inny profil)
//  - generation + resetKey, żeby stary timer nie zamknął nowego
// Nie mieszaj z ręcznym setTimeout(onClose) w tym samym modalu.
// Przy zmianach: MyProfile.tsx, OtherProfile.tsx.

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_CLOSE_MS = 220;

export function useModal(
  isOpen: boolean,
  onClose: () => void,
  options?: {
    closeDurationMs?: number;
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
