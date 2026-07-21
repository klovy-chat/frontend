import { useEffect, useState } from "react";
import { isOfficialNativeApp } from "../utils/device/isOfficialNativeApp";
import { isMobileOrTabletDevice } from "../utils/device/isMobileOrTablet";

export function shouldBlockMobileBrowserAccess(): boolean {
  if (!isMobileOrTabletDevice()) return false;
  if (isOfficialNativeApp()) return false;
  return true;
}

export function useMobileOrTabletBlock(): boolean {
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
