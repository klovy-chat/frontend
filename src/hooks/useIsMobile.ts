// useIsMobile.ts
// Wykrywa wąski viewport (layout mobilny z dolną nawigacją).
// Zakres:
//  - matchMedia na --bp-mobile-layout
//  - resize + orientationchange

import { useEffect, useState } from "react";

const MOBILE_LAYOUT_QUERY = "(max-width: 768px)";

export function isMobileLayout(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
}

export function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => isMobileLayout());

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_LAYOUT_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return mobile;
}
