/**
 * Detect phones and tablets. Touch laptops with fine pointer + hover stay allowed.
 */
export function isMobileOrTabletDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const ua = navigator.userAgent || "";

  if (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(
      ua,
    )
  ) {
    return true;
  }

  // iPadOS 13+ reports as MacIntel desktop Safari with touch.
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return true;
  }

  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const noHover = window.matchMedia("(hover: none)").matches;
  const shortSide = Math.min(window.screen.width, window.screen.height);

  // Coarse + no-hover + phone/tablet-sized screen.
  if (coarse && noHover && shortSide <= 1024) {
    return true;
  }

  return false;
}
