// Quote.tsx
// Blok cytatu (w dymku i nad composerem).
// Zakres:
//  - autor, skrót treści, skok do id
//  - autor + skrót; skok do id w liście
// Usunięty cytat: preview.ts czyści tip listy osobno.
// Przy zmianach: MessageBubble.tsx, MessageInput.tsx.

import { useTranslation } from "react-i18next";
import { getMessagePreview, getQuotedAuthorLabel, resolveQuotedMessage } from "../../utils/chat/messages";
import type { Message } from "../../types";
import "../../styles/chat/bubble.css";

interface QuoteProps {
  quotedMessage: Message["quotedMessage"];
  isOwn?: boolean;
  onJumpToMessage?: (messageId: string) => void;
}

export function Quote({
  quotedMessage,
  isOwn = false,
  onJumpToMessage,
}: QuoteProps) {
  const { t } = useTranslation();
  const quoted = resolveQuotedMessage(quotedMessage);
  if (!quoted) return null;

  const preview = getMessagePreview(quoted);
  const author = getQuotedAuthorLabel(quoted);
  const canJump = Boolean(onJumpToMessage && quoted._id && !quoted.deleted);

  return (
    <button
      type="button"
      className={`message-quote${isOwn ? " message-quote--own" : ""}${canJump ? " message-quote--clickable" : ""}`}
      onClick={() => {
        if (canJump && quoted._id) onJumpToMessage?.(quoted._id);
      }}
      disabled={!canJump}
      title={canJump ? t("messages.quote.jumpTo") : undefined}
    >
      <span className="message-quote-author">{author}</span>
      <span className="message-quote-text">{preview}</span>
    </button>
  );
}
