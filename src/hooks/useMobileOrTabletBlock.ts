import { useEffect, useState } from "react";
import { isMobileOrTabletDevice } from "../utils/device/isMobileOrTablet";

export function useMobileOrTabletBlock(): boolean {
  const [blocked, setBlocked] = useState(() => isMobileOrTabletDevice());

  useEffect(() => {
    const update = () => setBlocked(isMobileOrTabletDevice());

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
