import { Turnstile } from "@marsidev/react-turnstile";
import { isDevelopment } from "../../utils/env/appEnv";

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
}

const configuredSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";
const siteKey = configuredSiteKey;

export function TurnstileWidget({ onToken, onExpire }: TurnstileWidgetProps) {
  // Hide the Turnstile widget in development mode
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
        siteKey={siteKey}
        onSuccess={onToken}
        onExpire={() => onExpire?.()}
        options={{ theme: "dark", size: "flexible" }}
      />
    </div>
  );
}
