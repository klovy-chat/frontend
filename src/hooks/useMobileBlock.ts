// useMobileBlock.ts
// Blokada web na telefonie (produkt = desktop + Tauri).
// Zakres:
//  - isMobile vs isDesktop
//  - czy schować aplikację za DesktopOnly
// Wyjątek natywnej apki jest w isDesktop(), nie tutaj.
// Przy zmianach: DesktopOnly.tsx, isMobile.ts.

import { useEffect, useState } from "react";
import { isDesktop } from "../utils/device/isDesktop";
import { isMobile } from "../utils/device/isMobile";

export function shouldBlockMobileBrowserAccess(): boolean {
  if (!isMobile()) return false;
  if (isDesktop()) return false;
  return true;
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
