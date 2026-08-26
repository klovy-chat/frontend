// ReadReceipt.tsx
// Ptaszki przeczytania na własnych dymkach.
// Zakres:
//  - read z readBy / stanu listy
//  - ptaszki na własnych; to nie badge listy (read_state)
// Nie mylić z badge unread na liście — to inna ścieżka (read_state).
// Przy zmianach: MessageBubble.tsx, model/read_state.rs.

import { useTranslation } from "react-i18next";
import "../../styles/chat/bubble.css";

interface ReadReceiptProps {
  read?: boolean;
}

export function ReadReceipt({ read = false }: ReadReceiptProps) {
  const { t } = useTranslation();
  const label = read ? t("messages.receipt.read") : t("messages.receipt.delivered");

  return (
    <span
      className={`message-read-receipt${read ? " message-read-receipt--read" : ""}`}
      title={label}
      aria-label={label}
    >
      <svg
        width="16"
        height="11"
        viewBox="0 0 16 11"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M1.2 5.6L4.4 8.8 9.2 2.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.4 5.6L8.6 8.8 13.4 2.2"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
