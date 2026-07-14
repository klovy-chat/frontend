import type { ReactElement } from "react";
import { normalizeSessionBrowser } from "../../utils/user/sessionDisplay";

type BrowserIconKey =
  | "chrome"
  | "brave"
  | "edge"
  | "firefox"
  | "safari"
  | "opera"
  | "stoat"
  | "unknown";

function getBrowserIconKey(browser: string, isKnown: boolean): BrowserIconKey {
  if (!isKnown) return "unknown";

  switch (normalizeSessionBrowser(browser)) {
    case "Chrome":
      return "chrome";
    case "Brave":
      return "brave";
    case "Edge":
      return "edge";
    case "Firefox":
      return "firefox";
    case "Safari":
      return "safari";
    case "Opera":
      return "opera";
    case "Stoat For Web":
    case "Stoat IOS":
    case "Stoat For Android":
      return "stoat";
    default:
      return "unknown";
  }
}

interface BrowserSessionIconProps {
  browser: string;
  isKnown: boolean;
  className?: string;
}

function ChromeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 2a10 10 0 0 0-8.66 5h7.5l1.16-2.01A8 8 0 0 1 12 4c1.2 0 2.34.27 3.36.75L16.5 7h4.16A10 10 0 0 0 12 2Z"
      />
      <path
        fill="#FBBC04"
        d="M3.34 7A10 10 0 0 0 2 12c0 1.85.5 3.58 1.37 5.07L12 12V2.01A10 10 0 0 0 3.34 7Z"
      />
      <path
        fill="#34A853"
        d="M3.37 17.07A10 10 0 0 0 12 22a10 10 0 0 0 8.66-5h-7.5l-1.16 2.01A8 8 0 0 1 12 20a8 8 0 0 1-3.36-.75L7.5 17H3.34Z"
      />
      <path
        fill="#4285F4"
        d="M12 12 3.37 17.07A10 10 0 0 0 12 22c4.97 0 9.1-3.62 9.86-8.36L12 12Z"
      />
      <circle cx="12" cy="12" r="4.2" fill="#fff" />
      <circle cx="12" cy="12" r="3.2" fill="#4285F4" />
    </svg>
  );
}

function FirefoxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#FF7139"
        d="M12 2c-2.8 0-5.3 1.2-7.1 3.1 1.4-.5 2.9-.7 4.4-.5 2.1.3 4 1.3 5.4 2.8L12 2Z"
      />
      <path
        fill="#FF9500"
        d="M4.9 5.1C3.4 7 2.5 9.4 2.5 12c0 2.2.8 4.2 2.1 5.8l2.9-4.8-2.6-7.9Z"
      />
      <path
        fill="#FF7139"
        d="M12 22c4.2 0 7.8-2.6 9.3-6.3l-3.5-2.1-2.1 3.6c-1 .9-2.3 1.4-3.7 1.4-2.8 0-5.1-2-5.6-4.7l5.6-3.3Z"
      />
      <path
        fill="#20123A"
        d="M12 22c-4.2 0-7.8-2.6-9.3-6.3C4.7 18.8 8 21.5 12 21.5c2.2 0 4.2-.8 5.7-2.1l-1.8-3.1-4 2.1Z"
      />
      <circle cx="12" cy="12" r="3.5" fill="#FF9500" />
    </svg>
  );
}

function SafariIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="#0FB5EE" />
      <circle cx="12" cy="12" r="7.5" fill="#fff" />
      <path fill="#FF3B30" d="M12 5.5 16.5 17H7.5L12 5.5Z" />
      <path fill="#fff" d="M12 7.2 9.2 15.8h5.6L12 7.2Z" />
      <circle cx="12" cy="12" r="1.1" fill="#333" />
    </svg>
  );
}

function EdgeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#0078D4"
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.1 0 9.3-3.82 9.9-8.76-4.2 2.1-9.5.2-11.4-3.9C8.9 5.5 10.4 4 12 4c2.8 0 5.2 1.6 6.4 3.9.5-.9.8-1.9.8-3 0-.3 0-.6-.1-.9C17.5 2.7 14.9 2 12 2Z"
      />
      <path
        fill="#50E6FF"
        d="M21.9 11.24C20.3 14.1 17.4 16 14 16c-3.6 0-6.6-2.3-7.7-5.5 1.8 3.5 6.1 5.4 10.2 4.2 1.9-.6 3.5-1.8 4.4-3.4Z"
      />
    </svg>
  );
}

function OperaIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#FF1B2D" />
      <ellipse cx="12" cy="12" rx="4.5" ry="7" fill="#fff" />
    </svg>
  );
}

function BraveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#FB542B"
        d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3Zm0 2.2 5.8 3.3v6.5L12 18.8 6.2 15.3V8.5L12 5.2Z"
      />
      <path fill="#fff" d="M12 7.5 8.5 9.5v5l3.5 2 3.5-2v-5L12 7.5Z" />
      <path fill="#FB542B" d="M12 10.2 10.4 11v2l1.6.9 1.6-.9v-2L12 10.2Z" />
    </svg>
  );
}

function StoatIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="13" rx="2" fill="#5B6EE1" />
      <rect x="5" y="6" width="14" height="9" rx="1" fill="#E8ECFF" />
      <path fill="#5B6EE1" d="M9 20h6v1.5H9V20Z" />
      <circle cx="12" cy="10.5" r="2" fill="#5B6EE1" />
    </svg>
  );
}

function UnknownIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        fill="currentColor"
        d="M10.6 9.1c.2-1.2 1.2-2 2.5-2 1.4 0 2.4.9 2.4 2.2 0 1-.5 1.5-1.4 2.1-.8.5-1.1.9-1.1 1.8v.3h-1.8v-.4c0-1.1.5-1.7 1.3-2.2.7-.5 1-1 1-1.7 0-.8-.6-1.3-1.5-1.3-.8 0-1.4.5-1.5 1.3H10.6Zm2.5 6.8c-.8 0-1.4-.6-1.4-1.4s.6-1.4 1.4-1.4 1.4.6 1.4 1.4-.6 1.4-1.4 1.4Z"
      />
    </svg>
  );
}

const ICONS: Record<BrowserIconKey, () => ReactElement> = {
  chrome: ChromeIcon,
  brave: BraveIcon,
  edge: EdgeIcon,
  firefox: FirefoxIcon,
  safari: SafariIcon,
  opera: OperaIcon,
  stoat: StoatIcon,
  unknown: UnknownIcon,
};

export function BrowserSessionIcon({
  browser,
  isKnown,
  className = "",
}: BrowserSessionIconProps) {
  const key = getBrowserIconKey(normalizeSessionBrowser(browser), isKnown);
  const Icon = ICONS[key];

  return (
    <span
      className={`as-session-icon${isKnown ? "" : " as-session-icon--unknown"} ${className}`.trim()}
      aria-hidden="true"
    >
      <Icon />
    </span>
  );
}
