type NavigatorWithUaData = Navigator & {
  userAgentData?: { mobile?: boolean };
};

function uaReportsMobile(): boolean {
  const ua = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(
    ua,
  );
}

function uaClientHintsMobile(): boolean {
  return (navigator as NavigatorWithUaData).userAgentData?.mobile === true;
}

function isIpadDesktopSafari(): boolean {
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

function isCompactTouchDevice(): boolean {
  const shortSide = Math.min(window.screen.width, window.screen.height);
  if (shortSide > 1024 || navigator.maxTouchPoints <= 0) {
    return false;
  }

  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const hover = window.matchMedia("(hover: hover)").matches;

  // Touch laptops keep fine pointer + hover; phones/tablets usually do not,
  // even when the browser UA is spoofed via "request desktop site".
  return !(finePointer && hover);
}

function isCoarseTouchViewport(): boolean {
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  return coarse && noHover && shortSide <= 1024;
}

/**
 * Detect phones and tablets, including mobile browsers in "desktop site" mode.
 * Touch laptops with fine pointer + hover stay allowed.
 */
export function isMobileOrTabletDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  if (
    uaReportsMobile() ||
    uaClientHintsMobile() ||
    isIpadDesktopSafari() ||
    isCompactTouchDevice() ||
    isCoarseTouchViewport()
  ) {
    return true;
  }

  return false;
}
