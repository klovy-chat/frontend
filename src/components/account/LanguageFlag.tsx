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
      <svg viewBox="0 0 741 390" xmlns="http://www.w3.org/2000/svg">
        <rect width="741" height="390" fill="#B22234" />
        <path
          stroke="#FFFFFF"
          strokeWidth="30"
          d="M0 30h741M0 90h741M0 150h741M0 210h741M0 270h741M0 330h741"
        />
        <rect width="296.4" height="210" fill="#3C3B6E" />
        <g fill="#FFFFFF">
          <circle cx="37" cy="21" r="12" />
          <circle cx="111" cy="21" r="12" />
          <circle cx="185" cy="21" r="12" />
          <circle cx="259" cy="21" r="12" />
          <circle cx="74" cy="63" r="12" />
          <circle cx="148" cy="63" r="12" />
          <circle cx="222" cy="63" r="12" />
          <circle cx="37" cy="105" r="12" />
          <circle cx="111" cy="105" r="12" />
          <circle cx="185" cy="105" r="12" />
          <circle cx="259" cy="105" r="12" />
          <circle cx="74" cy="147" r="12" />
          <circle cx="148" cy="147" r="12" />
          <circle cx="222" cy="147" r="12" />
          <circle cx="37" cy="189" r="12" />
          <circle cx="111" cy="189" r="12" />
          <circle cx="185" cy="189" r="12" />
          <circle cx="259" cy="189" r="12" />
        </g>
      </svg>
    </span>
  );
}
