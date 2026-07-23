import { useEffect, useState } from "react";

/** Mobile / natywna apka — jeden wspólny breakpoint z CSS. */
export function useCompactMobileShell(): boolean {
  const [compact, setCompact] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(max-width: 960px)").matches
      || document.documentElement.dataset.klovyNative === "1"
    );
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 960px)");
    const update = () => {
      setCompact(mq.matches || document.documentElement.dataset.klovyNative === "1");
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return compact;
}
