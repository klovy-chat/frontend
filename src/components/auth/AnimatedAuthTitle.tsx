import { useEffect, useState } from "react";

interface AnimatedAuthTitleProps {
  text: string;
  className: string;
}

export function AnimatedAuthTitle({ text, className }: AnimatedAuthTitleProps) {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleText(text);
      return;
    }

    setVisibleText("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, 65);

    return () => window.clearInterval(timer);
  }, [text]);

  return (
    <h1 className={`${className} al-animated-title`} aria-label={text}>
      <span aria-hidden="true">{visibleText}</span>
      {visibleText.length < text.length && <span className="al-animated-title__caret" aria-hidden="true" />}
    </h1>
  );
}
