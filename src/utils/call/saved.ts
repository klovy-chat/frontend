// saved.ts
// Ostatnio wybrane devices kamery/mic.
// Zakres:
//  - przywracanie po reconnect
//  - ostatnio wybrane mic/kamera do reconnect
// Nie mylić z voice.ts (ustawienia mikrofonu czatu vs call).
// Przy zmianach: CallContext.tsx, VoiceSettings.tsx.

import type { CallMode, CallPeer } from "../../context/CallContext";

const STORAGE_KEY = "klovy-active-call";

export interface PersistedCall {
  userId: string;
  peer: CallPeer;
  mode: CallMode;
  startedAt: number;
}

export function savePersistedCall(data: PersistedCall): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {

  }
}

export function loadPersistedCall(): PersistedCall | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCall;
    if (
      !parsed?.userId ||
      !parsed?.peer?._id ||
      !parsed?.startedAt ||
      (parsed.mode !== "audio" && parsed.mode !== "video")
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPersistedCall(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
