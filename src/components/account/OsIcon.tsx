// OsIcon.tsx
// Ikonka OS w wierszu sesji.
// Zakres:
//  - Windows/macOS/Linux/…
//  - gałęzie OS jak w osLabel.ts — nie zgaduj z surowego UA
// Etykieta tekstowa: osLabel.ts.
// Przy zmianach: Panel.tsx, osLabel.ts.

import { resolveOsIconKey } from "../../utils/user/session";

interface OsIconProps {
  os: string;
  className?: string;
}

function WindowsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#0078D4"
        d="M3 12V6.75l6-1.32v6.48L3 12zm17-9v8.75l-10 .15V5.21L20 3zM3 13l6 .09v7.81l-6-1.15V13zm17 .08V22l-10-1.8v-7.15l10 .03z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#A2AAAD"
        d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.090-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"
      />
    </svg>
  );
}

function AndroidIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#3DDC84"
        d="M17.523 15.341a.995.995 0 0 1-.999-1 .999-.999 1 .999 1 .999-.448.999-1m-11.046 0a.995.995 0 0 1-.999-1 .999-.999 1 .999 1 .999-.448.999-1M17.523 7.341v-1.5h1.5v1.5h-1.5m-13.046 0v-1.5h1.5v1.5h-1.5M7.977 3.841l-.75-1.299 1.299.75-.549 1.299zm8.046 0 .75-1.299-1.299.75.549 1.299M12 4.341c-3.866 0-7 3.134-7 7v4.5c0 .828.672 1.5 1.5 1.5h11c.828 0 1.5-.672 1.5-1.5v-4.5c0-3.866-3.134-7-7-7"
      />
    </svg>
  );
}

function LinuxIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#FCC624"
        d="M12.504 0c-.155 0-.311.002-.466.01-3.787.18-6.893 2.427-7.874 5.645-.42 1.316-.555 2.702-.343 4.064.042.257.096.512.157.762-1.617-.744-2.77-2.123-3.094-3.812-.372-1.945.189-3.954 1.576-5.634C4.417 1.212 6.634.035 9.014.002 9.172.001 9.33 0 9.488 0h3.016zm-.001 22c.155 0 .311-.002.466-.01 3.787-.18 6.893-2.427 7.874-5.645.42-1.316.555-2.702.343-4.064a6.8 6.8 0 0 0-.157-.762c1.617.744 2.77 2.123 3.094 3.812.372 1.945-.189 3.954-1.576 5.634-1.624 1.971-3.841 3.148-6.221 3.181-.158.001-.316.002-.474.002H12.503z"
      />
    </svg>
  );
}

function UnknownOsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path fill="currentColor" d="M8 20h8v1.5H8V20Z" />
    </svg>
  );
}

function OsIconGraphic({ osKey }: { osKey: ReturnType<typeof resolveOsIconKey> }) {
  switch (osKey) {
    case "windows":
      return <WindowsIcon />;
    case "mac":
    case "ios":
      return <AppleIcon />;
    case "android":
      return <AndroidIcon />;
    case "linux":
      return <LinuxIcon />;
    default:
      return <UnknownOsIcon />;
  }
}

export function OsIcon({ os, className = "" }: OsIconProps) {
  const key = resolveOsIconKey(os);

  return (
    <span
      className={`as-session-icon as-session-icon--os${key === "unknown" ? " as-session-icon--unknown" : ""} ${className}`.trim()}
      aria-hidden="true"
    >
      <OsIconGraphic osKey={key} />
    </span>
  );
}
