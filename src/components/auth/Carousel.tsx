// Carousel.tsx
// Slajdy po lewej stronie auth.
// Zakres:
//  - czysto prezentacyjne
//  - slajdy i18n po lewej; zero logiki auth
// Treść slajdów / i18n tu albo w JSON.
// Przy zmianach: AuthLayout.tsx.

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, MessageCircle, Phone, Shield } from "lucide-react";

export interface AuthSlide {
  tag: string;
  title: string;
  desc: string;
  icon: ReactNode;
}

export function useAuthSlides(): AuthSlide[] {
  const { t } = useTranslation();
  return useMemo(
    () => [
      {
        tag: t("auth.carousel.privacy.tag"),
        title: t("auth.carousel.privacy.title"),
        desc: t("auth.carousel.privacy.desc"),
        icon: <Shield size={22} strokeWidth={2} />,
      },
      {
        tag: t("auth.carousel.encryption.tag"),
        title: t("auth.carousel.encryption.title"),
        desc: t("auth.carousel.encryption.desc"),
        icon: <Lock size={22} strokeWidth={2} />,
      },
      {
        tag: t("auth.carousel.calls.tag"),
        title: t("auth.carousel.calls.title"),
        desc: t("auth.carousel.calls.desc"),
        icon: <Phone size={22} strokeWidth={2} />,
      },
      {
        tag: t("auth.carousel.community.tag"),
        title: t("auth.carousel.community.title"),
        desc: t("auth.carousel.community.desc"),
        icon: <MessageCircle size={22} strokeWidth={2} />,
      },
    ],
    [t],
  );
}

export function Carousel({ slides }: { slides: AuthSlide[] }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [exiting, setExiting] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = (idx: number) => {
    if (idx === current) return;
    setExiting(current);
    setTimeout(() => setExiting(null), 500);
    setCurrent(idx);
  };

  useEffect(() => {
    if (slides.length < 2) return;
    timerRef.current = setInterval(() => {
      setCurrent((c) => {
        const next = (c + 1) % slides.length;
        setExiting(c);
        setTimeout(() => setExiting(null), 500);
        return next;
      });
    }, 4000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [slides.length]);

  return (
    <div className="al-right">
      <div className="al-slides">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={[
              "al-slide",
              i === current ? "active" : "",
              i === exiting ? "exit" : "",
            ].filter(Boolean).join(" ")}
          >
            <div className="al-slide-icon">{slide.icon}</div>
            <p className="al-slide-tag">{slide.tag}</p>
            <h2 className="al-slide-title">{slide.title}</h2>
            <p className="al-slide-desc">{slide.desc}</p>
          </div>
        ))}
      </div>

      <div className="al-dots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={["al-dot", i === current ? "active" : ""].filter(Boolean).join(" ")}
            onClick={() => goTo(i)}
            aria-label={t("auth.carousel.slideAria", { n: i + 1 })}
          />
        ))}
      </div>
    </div>
  );
}
