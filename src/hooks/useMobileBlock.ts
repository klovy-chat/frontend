// useMobileBlock.ts
// Blokada web na telefonie (produkt = desktop + Tauri).
// Zakres:
//  - isMobile vs isDesktop
//  - czy schować aplikację za DesktopOnly
// Wyjątek natywnej apki jest w isDesktop(), nie tutaj.
// Przy zmianach: DesktopOnly.tsx, isMobile.ts.

import { useEffect, useState } from "react";

export function shouldBlockMobileBrowserAccess(): boolean {
  return false;
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
