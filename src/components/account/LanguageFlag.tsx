import type { AppLocale } from "../../languages";

interface LanguageFlagProps {
  locale: AppLocale;
  className?: string;
}

export function LanguageFlag({ locale, className = "" }: LanguageFlagProps) {
  if (locale === "pl") {
    return (
      <span className={`as-lang-flag ${className}`.trim()} aria-hidden="true">
        <svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg">
          <rect width="28" height="20" fill="#FFFFFF" />
          <rect y="10" width="28" height="10" fill="#DC143C" />
        </svg>
      </span>
    );
  }

  return (
    <span className={`as-lang-flag ${className}`.trim()} aria-hidden="true">
      <svg viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg">
        <rect width="28" height="20" fill="#B22234" />
        <path fill="#FFFFFF" d="M0 1.54h28M0 3.08h28M0 4.62h28M0 6.16h28M0 7.7h28M0 9.24h28M0 10.78h28M0 12.32h28M0 13.86h28M0 15.4h28M0 16.94h28M0 18.48h28" />
        <rect width="12" height="10.8" fill="#3C3B6E" />
        <g fill="#FFFFFF">
          <circle cx="2.2" cy="1.8" r="0.55" />
          <circle cx="4.8" cy="1.8" r="0.55" />
          <circle cx="7.4" cy="1.8" r="0.55" />
          <circle cx="10" cy="1.8" r="0.55" />
          <circle cx="3.5" cy="3.5" r="0.55" />
          <circle cx="6.1" cy="3.5" r="0.55" />
          <circle cx="8.7" cy="3.5" r="0.55" />
          <circle cx="2.2" cy="5.2" r="0.55" />
          <circle cx="4.8" cy="5.2" r="0.55" />
          <circle cx="7.4" cy="5.2" r="0.55" />
          <circle cx="10" cy="5.2" r="0.55" />
          <circle cx="3.5" cy="6.9" r="0.55" />
          <circle cx="6.1" cy="6.9" r="0.55" />
          <circle cx="8.7" cy="6.9" r="0.55" />
          <circle cx="2.2" cy="8.6" r="0.55" />
          <circle cx="4.8" cy="8.6" r="0.55" />
          <circle cx="7.4" cy="8.6" r="0.55" />
          <circle cx="10" cy="8.6" r="0.55" />
        </g>
      </svg>
    </span>
  );
}
