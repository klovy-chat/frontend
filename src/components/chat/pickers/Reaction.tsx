// Reaction.tsx
// Mały picker reakcji przy dymku.
// Zakres:
//  - toggle chipa, pozycja fixed
//  - toggle chipa przy dymku; merge.ts broni wipe
// Optimistic update + WS react; merge.ts broni przed wipe.
// Przy zmianach: MessageBubble.tsx, reactions.ts, reaction.css.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { getReactionPickerEmojis } from "../../../api/emojis";
import { ApiError } from "../../../api/client";
import "../../../styles/pickers/reaction.css";

interface ReactionProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  style?: React.CSSProperties;
}

export function Reaction({ onSelect, onClose, style }: ReactionProps) {
  const { t } = useTranslation();
  const pickerRef = useRef<HTMLDivElement>(null);
  const [quickReactions, setQuickReactions] = useState<string[]>([]);
  const [gridEmojis, setGridEmojis] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      const target = event.target as Node;
      if (pickerRef.current && !pickerRef.current.contains(target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;

    getReactionPickerEmojis()
      .then(({ quick, grid }) => {
        if (cancelled) return;
        setQuickReactions(quick);
        setGridEmojis(grid);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : t("chat.pickers.reaction.loadFailed"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <div
      ref={pickerRef}
      className="reaction-picker"
      style={style}
      role="dialog"
      aria-label={t("chat.pickers.reaction.ariaLabel")}
    >
      {error ? (
        <div className="reaction-picker-status reaction-picker-error">{error}</div>
      ) : (
        <>
          <div className="reaction-picker-quick">
            {loading
              ? Array.from({ length: 6 }, (_, i) => (
                  <span
                    key={i}
                    className="reaction-picker-item reaction-picker-item--quick reaction-picker-item--placeholder"
                    aria-hidden
                  />
                ))
              : quickReactions.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="reaction-picker-item reaction-picker-item--quick"
                    onClick={() => onSelect(emoji)}
                    title={emoji}
                  >
                    <span className="picker-emoji-glyph" aria-hidden>
                      {emoji}
                    </span>
                  </button>
                ))}
          </div>
          <div className="reaction-picker-divider" />
          {loading ? (
            <div className="reaction-picker-status">{t("common.loading")}</div>
          ) : (
            <div className="reaction-picker-grid">
              {gridEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="reaction-picker-item"
                  onClick={() => onSelect(emoji)}
                  title={emoji}
                >
                  <span className="picker-emoji-glyph" aria-hidden>
                    {emoji}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
