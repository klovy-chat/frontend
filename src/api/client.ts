import { getBackendBaseUrl } from "../utils/env/backendUrl";
import { usesDirectBackendUrl } from "../utils/env/appEnv";
import { CLIENT_HEADER_NAME, CLIENT_IDENTIFIER, CLIENT_USER_AGENT_HEADER } from "../utils/env/clientId";
import {
  absorbCsrfToken,
  clearCsrfToken,
  getCsrfToken,
} from "../utils/auth/csrfToken";
import i18n from "../i18n/config";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

class NetworkError extends Error {
  constructor(message = i18n.t("api.networkError")) {
    super(message);
    this.name = "NetworkError";
  }
}

function isFetchNetworkError(error: unknown): boolean {
  if (!(error instanceof TypeError)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("load failed") ||
    message.includes("network request failed") ||
    message.includes("fetch failed")
  );
}

export function isTransientApiError(error: unknown): boolean {
  if (error instanceof NetworkError) return true;
  if (error instanceof ApiError) {
    return error.status === 502 || error.status === 503 || error.status === 504;
  }
  return isFetchNetworkError(error);
}

/** Retry transient upload/proxy failures (502/503/504/network) with short backoff. */
export async function withTransientRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i === attempts - 1 || !isTransientApiError(error)) {
        throw error;
      }
      await new Promise((resolve) => {
        window.setTimeout(resolve, 300 * (i + 1));
      });
    }
  }
  throw lastError;
}

function isMutatingMethod(method: string): boolean {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
}

function isCsrfExempt(path: string, method: string): boolean {
  if (!isMutatingMethod(method)) return true;

  const exactExemptPaths = [
    "/api/auth/login",
    "/api/auth/sign-in",
    "/api/auth/signin",
    "/api/auth/signup",
    "/api/auth/register",
    "/api/auth/login/2fa",
    "/api/auth/refresh",
    "/api/admin/login",
    "/api/admins/login",
  ];

  if (exactExemptPaths.includes(path)) {
    return true;
  }

  return path.startsWith("/api/security");
}

type ApiRequestOptions = RequestInit & {
  _retriedAfterRefresh?: boolean;
};

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    let url = "/api/auth/refresh";
    if (usesDirectBackendUrl) {
      url = `${getBackendBaseUrl()}${url}`;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          [CLIENT_HEADER_NAME]: CLIENT_IDENTIFIER,
          ...(typeof navigator !== "undefined" && navigator.userAgent
            ? { [CLIENT_USER_AGENT_HEADER]: navigator.userAgent }
            : {}),
        },
      });
      if (!response.ok) return false;

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = (await response.json()) as unknown;
        absorbCsrfToken(data);
      }

      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const method = (options.method ?? "GET").toUpperCase();

  headers.set(CLIENT_HEADER_NAME, CLIENT_IDENTIFIER);
  if (typeof navigator !== "undefined" && navigator.userAgent) {
    headers.set(CLIENT_USER_AGENT_HEADER, navigator.userAgent);
  }

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  if (!isCsrfExempt(path, method)) {
    const csrf = getCsrfToken();
    if (!csrf) {
      throw new ApiError(i18n.t("api.csrfMissing"), 403);
    }
    headers.set("X-CSRF-Token", csrf);
  }

  let url = path;

  if (usesDirectBackendUrl) {
    url = `${getBackendBaseUrl()}${path}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch (error) {
    if (isFetchNetworkError(error)) {
      throw new NetworkError();
    }
    throw error;
  }

  if (
    response.status === 401 &&
    !options._retriedAfterRefresh &&
    path !== "/api/auth/refresh" &&
    path !== "/api/auth/logout"
  ) {
    const refreshed = await tryRefreshSession();
    if (refreshed) {
      return apiRequest<T>(path, {
        ...options,
        _retriedAfterRefresh: true,
      });
    }
  }

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");

  if (!response.ok) {
    let message = response.statusText;
    if (isJson) {
      const data = (await response.json()) as {
        message?: string;
        error?: string;
      };
      message = data.message ?? data.error ?? message;
    } else {
      const text = await response.text();
      if (text) message = text;
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (isJson) {
    const data = absorbCsrfToken((await response.json()) as unknown);
    return data as T;
  }

  return (await response.text()) as T;
}

export { clearCsrfToken };
