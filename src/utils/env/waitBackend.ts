// waitBackend.ts
// Czeka aż /api odpowie (w DEV przez proxy, współdzielony Promise).
// Zakres:
//  - w prod jeden ping
//  - czeka na /api (DEV: proxy); start WS i restore tu wiszą
// Nie zwiększaj delay bez potrzeby — start WS i restore sesji tu wiszą.
// Przy zmianach: WebSocketContext.tsx, restore.ts.

import { getBackendBaseUrl } from "./backend";
import { usesDirectBackendUrl } from "./appEnv";

function healthCheckUrl(): string {
  if (usesDirectBackendUrl) {
    return `${getBackendBaseUrl()}/api`;
  }
  return "/api";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function pingBackendOnce(): Promise<boolean> {
  try {
    const response = await fetch(healthCheckUrl(), {
      method: "GET",
      credentials: "include",
    });
    return response.ok;
  } catch {
    return false;
  }
}

let waitPromise: Promise<boolean> | null = null;

export function waitBackend(
  maxAttempts = 40,
  delayMs = 500,
): Promise<boolean> {
  if (usesDirectBackendUrl) {
    return pingBackendOnce();
  }

  if (!waitPromise) {
    waitPromise = (async () => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (await pingBackendOnce()) {
          return true;
        }
        if (attempt < maxAttempts - 1) {
          await delay(delayMs);
        }
      }
      return false;
    })().finally(() => {
      waitPromise = null;
    });
  }

  return waitPromise;
}

export function getBackendStartHint(): string {
  return "Uruchom backend: cd backend && cargo run";
}
