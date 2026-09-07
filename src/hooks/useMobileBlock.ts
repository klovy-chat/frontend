// useMobileBlock.ts
// Blokada web na telefonie; natywna powłoka Capacitor jest dozwolona.
// Zakres:
//  - isMobile vs isDesktop
//  - czy schować aplikację za DesktopOnly
// Wyjątek natywnej apki jest w isDesktop(), nie tutaj.
// Przy zmianach: DesktopOnly.tsx, isMobile.ts.

import { useEffect, useState } from "react";
import { isCapacitor, isDesktop } from "../utils/device/isDesktop";
import { isMobile } from "../utils/device/isMobile";

export function shouldBlockMobileBrowserAccess(): boolean {
  if (isDesktop() || isCapacitor()) return false;
  return isMobile();
}

export function useMobileBlock(): boolean {
  const [blocked, setBlocked] = useState(() => shouldBlockMobileBrowserAccess());

  useEffect(() => {
    const update = () => setBlocked(shouldBlockMobileBrowserAccess());

    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  return blocked;
}
