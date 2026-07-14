import { ReactNode, useEffect, useRef, useState } from "react";

export interface AuthSlide {
  tag: string;
  title: string;
  desc: string;
  icon: ReactNode;
}

export function AuthCarousel({ slides }: { slides: AuthSlide[] }) {
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
            aria-label={`Slajd ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
