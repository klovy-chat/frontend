import * as authApi from "../../api/auth";
import { ApiError, isTransientApiError } from "../../api/client";
import { usesDirectBackendUrl } from "../env/appEnv";
import { waitForBackend } from "../env/waitForBackend";
import type { User } from "../../types";

const BASE_DELAY_MS = 350;
const MIN_FORCE_REFRESH_MS = 5_000;

type UserInfoResponse = User & { sessionNeedsRefresh?: boolean };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function bindSessionIfNeeded(user: UserInfoResponse): Promise<User> {
  if (!user.sessionNeedsRefresh) {
    return user;
  }
  try {
    const refreshed = await authApi.refreshSession();
    return refreshed.user;
  } catch {
    return user;
  }
}

async function fetchUserInfoWithRetry(): Promise<User | null> {
  if (!usesDirectBackendUrl) {
    const ready = await waitForBackend();
    if (!ready) return null;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const user = (await authApi.getUserInfo()) as UserInfoResponse;
      return await bindSessionIfNeeded(user);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        try {
          const refreshed = await authApi.refreshSession();
          return refreshed.user;
        } catch {
          return null;
        }
      }

      if (error instanceof ApiError && error.status === 429) {
        return null;
      }

      if (isTransientApiError(error) && attempt < 2) {
        await delay(BASE_DELAY_MS * (attempt + 1));
        continue;
      }

      if (isTransientApiError(error)) {
        return null;
      }

      throw error;
    }
  }

  return null;
}

let sessionRestorePromise: Promise<User | null> | null = null;
let lastSuccessfulRestoreAt = 0;
let cachedUser: User | null = null;

export function restoreSession(force = false): Promise<User | null> {
  const now = Date.now();
  if (
    force &&
    cachedUser &&
    now - lastSuccessfulRestoreAt < MIN_FORCE_REFRESH_MS
  ) {
    return Promise.resolve(cachedUser);
  }

  if (sessionRestorePromise) {
    return sessionRestorePromise;
  }

  sessionRestorePromise = fetchUserInfoWithRetry()
    .then((user) => {
      if (user) {
        cachedUser = user;
        lastSuccessfulRestoreAt = Date.now();
      }
      return user;
    })
    .finally(() => {
      sessionRestorePromise = null;
    });

  return sessionRestorePromise;
}

export function clearCachedSessionUser(): void {
  cachedUser = null;
  lastSuccessfulRestoreAt = 0;
}
