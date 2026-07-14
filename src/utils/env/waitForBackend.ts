import { getBackendBaseUrl } from "./backendUrl";
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

/**
 * Czeka aż backend odpowie (przez proxy Vite w dev lub bezpośrednio w prod).
 * Współdzielone między równoległymi wywołaniami.
 */
export function waitForBackend(
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
