import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { isDevelopment } from "../../utils/env/appEnv";

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

export interface TurnstileWidgetHandle {
  /** Discards the current token and requests a fresh challenge. */
  reset: () => void;
}

const configuredSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";
const siteKey = configuredSiteKey;

/**
 * Cloudflare Turnstile wrapper.
 *
 * Turnstile tokens are single-use and short-lived. To eliminate intermittent
 * "invalid turnstile token" errors we:
 *  - expose an imperative `reset()` so callers can request a fresh token after
 *    any failed auth attempt (reusing a consumed token is the #1 cause);
 *  - auto-reset on expiry and on widget errors so a stale/empty token is never
 *    left in parent state.
 */
export const TurnstileWidget = forwardRef<
  TurnstileWidgetHandle,
  TurnstileWidgetProps
>(function TurnstileWidget({ onToken, onExpire, onError }, ref) {
  const instanceRef = useRef<TurnstileInstance | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      try {
        instanceRef.current?.reset();
      } catch {
        /* widget may not be mounted yet */
      }
    },
  }));

  // Hide the Turnstile widget in development mode (backend also bypasses).
  if (isDevelopment) return null;

  if (!siteKey) {
    return (
      <div className="turnstile-wrap turnstile-error">
        Brak konfiguracji Turnstile (VITE_TURNSTILE_SITE_KEY).
      </div>
    );
  }

  return (
    <div className="turnstile-wrap">
      <Turnstile
        ref={instanceRef}
        siteKey={siteKey}
        onSuccess={onToken}
        onExpire={() => {
          onExpire?.();
          try {
            instanceRef.current?.reset();
          } catch {
            /* noop */
          }
        }}
        onError={() => {
          onError?.();
          try {
            instanceRef.current?.reset();
          } catch {
            /* noop */
          }
        }}
        options={{ theme: "dark", size: "flexible", retry: "auto" }}
      />
    </div>
  );
});
