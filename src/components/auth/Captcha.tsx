// Captcha.tsx
// Cloudflare Turnstile: token, expire, reset.
// Zakres:
//  - w DEV widget ukryty, backend i tak bypassuje
//  - token, expire, reset(); po 4xx zawsze nowy token
// Token jednorazowy — po 4xx zawsze reset().
// Przy zmianach: Login.tsx, Signup.tsx, middlewares/captcha.rs.

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { forwardRef, useImperativeHandle, useRef } from "react";
import { isDevelopment } from "../../utils/env/appEnv";

interface CaptchaProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

export interface CaptchaHandle {

  reset: () => void;
}

const configuredSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";
const siteKey = configuredSiteKey;

export const Captcha = forwardRef<
  CaptchaHandle,
  CaptchaProps
>(function Captcha({ onToken, onExpire, onError }, ref) {
  const instanceRef = useRef<TurnstileInstance | null>(null);

  useImperativeHandle(ref, () => ({
    reset: () => {
      try {
        instanceRef.current?.reset();
      } catch {

      }
    },
  }));

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
