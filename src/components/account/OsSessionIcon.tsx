import type { CSSProperties } from "react";
import { resolveOsIconKey } from "../../utils/user/sessionDisplay";
import windowsIcon from "../../assets/os/windows.svg";
import appleIcon from "../../assets/os/apple.svg";
import androidIcon from "../../assets/os/android.svg";
import linuxIcon from "../../assets/os/linux.svg";

type OsIconKey = ReturnType<typeof resolveOsIconKey>;

interface OsIconConfig {
  src?: string;
  color: string;
}

const OS_ICONS: Record<Exclude<OsIconKey, "unknown">, OsIconConfig> = {
  windows: { src: windowsIcon, color: "#0078D4" },
  mac: { src: appleIcon, color: "#A2AAAD" },
  ios: { src: appleIcon, color: "#A2AAAD" },
  android: { src: androidIcon, color: "#3DDC84" },
  linux: { src: linuxIcon, color: "#FCC624" },
};

interface OsSessionIconProps {
  os: string;
  className?: string;
}

function BrandOsIcon({ src, color }: Required<Pick<OsIconConfig, "src" | "color">>) {
  return (
    <span
      className="as-session-icon__brand"
      style={
        {
          backgroundColor: color,
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
        } as CSSProperties
      }
      aria-hidden="true"
    />
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

export function OsSessionIcon({ os, className = "" }: OsSessionIconProps) {
  const key = resolveOsIconKey(os);
  const icon = key !== "unknown" ? OS_ICONS[key] : null;

  return (
    <span
      className={`as-session-icon as-session-icon--os${key === "unknown" ? " as-session-icon--unknown" : ""} ${className}`.trim()}
      aria-hidden="true"
    >
      {icon?.src ? (
        <BrandOsIcon src={icon.src} color={icon.color} />
      ) : (
        <UnknownOsIcon />
      )}
    </span>
  );
}
