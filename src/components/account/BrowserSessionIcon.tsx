import { normalizeSessionBrowser } from "../../utils/user/sessionDisplay";
import googleChromeIcon from "../../assets/browsers/googlechrome.svg";
import firefoxIcon from "../../assets/browsers/firefox.svg";
import safariIcon from "../../assets/browsers/safari.svg";
import microsoftEdgeIcon from "../../assets/browsers/microsoftedge.svg";
import operaIcon from "../../assets/browsers/opera.svg";
import braveIcon from "../../assets/browsers/brave.svg";
import vivaldiIcon from "../../assets/browsers/vivaldi.svg";

type BrowserIconKey =
  | "chrome"
  | "brave"
  | "edge"
  | "firefox"
  | "safari"
  | "opera"
  | "vivaldi"
  | "stoat"
  | "unknown";

interface BrowserIconConfig {
  src?: string;
  color?: string;
}

const BROWSER_ICONS: Record<Exclude<BrowserIconKey, "stoat" | "unknown">, BrowserIconConfig> = {
  chrome: { src: googleChromeIcon, color: "#4285F4" },
  firefox: { src: firefoxIcon, color: "#FF7139" },
  safari: { src: safariIcon, color: "#006CFF" },
  edge: { src: microsoftEdgeIcon, color: "#0078D7" },
  opera: { src: operaIcon, color: "#FF1B2D" },
  brave: { src: braveIcon, color: "#FB542B" },
  vivaldi: { src: vivaldiIcon, color: "#EF3939" },
};

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
    case "Vivaldi":
      return "vivaldi";
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

function BrandBrowserIcon({ src, color }: Required<BrowserIconConfig>) {
  return (
    <span
      className="as-session-icon__brand"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      <img src={src} alt="" draggable={false} />
    </span>
  );
}

export function BrowserSessionIcon({
  browser,
  isKnown,
  className = "",
}: BrowserSessionIconProps) {
  const key = getBrowserIconKey(normalizeSessionBrowser(browser), isKnown);
  const icon = key !== "stoat" && key !== "unknown" ? BROWSER_ICONS[key] : null;

  return (
    <span
      className={`as-session-icon${isKnown ? "" : " as-session-icon--unknown"} ${className}`.trim()}
      aria-hidden="true"
    >
      {icon?.src && icon.color ? (
        <BrandBrowserIcon src={icon.src} color={icon.color} />
      ) : key === "stoat" ? (
        <StoatIcon />
      ) : (
        <UnknownIcon />
      )}
    </span>
  );
}
