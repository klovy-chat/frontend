// Emoji.tsx
// Picker emoji (grupy z API, szukajka, click-outside).
// Zakres:
//  - wstawia znak do composera
//  - grupy z API, szukajka, wstawka do composera
// Custom emoji serwera: api/emojis + ten widok.
// Przy zmianach: MessageInput.tsx, emoji.css, api/emojis.ts.

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { getEmojis, type EmojiGroup } from "../../../api/emojis";
import { ApiError } from "../../../api/client";
import "../../../styles/pickers/emoji.css";

interface EmojiProps {
  onEmojiSelect: (emoji: string) => void;
  onClose?: () => void;
}

export function Emoji({ onEmojiSelect, onClose }: EmojiProps) {
  const { t } = useTranslation();
  const pickerRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [groups, setGroups] = useState<EmojiGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    getEmojis()
      .then((data) => {
        if (!cancelled) setGroups(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError
            ? err.message
            : t("chat.pickers.emoji.loadFailed"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [t]);

  const handleEmojiClick = (emoji: string) => {
    onEmojiSelect(emoji);
    setSearchTerm("");
  };

  const searchResults = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return null;
    const matches: { char: string; name: string }[] = [];
    for (const group of groups) {
      for (const emoji of group.emojis) {
        if (
          emoji.name.includes(query) ||
          emoji.keywords.includes(query)
        ) {
          matches.push({ char: emoji.char, name: emoji.name });
        }
      }
    }
    return matches;
  }, [searchTerm, groups]);

  return (
    <div className="emoji-picker" ref={pickerRef}>
      <input
        type="text"
        className="emoji-picker-search"
        placeholder={t("chat.pickers.emoji.searchPlaceholder")}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        autoFocus
      />

      {error && <div className="emoji-picker-status emoji-picker-error">{error}</div>}

      {!error && loading && (
        <div className="emoji-picker-status">{t("common.loading")}</div>
      )}

      {!error && !loading && searchResults && (
        <div className="emoji-picker-scroll">
          {searchResults.length === 0 ? (
            <div className="emoji-picker-status">
              {t("chat.pickers.emoji.noResults", { term: searchTerm })}
            </div>
          ) : (
            <div className="emoji-picker-grid">
              {searchResults.map((emoji) => (
                <button
                  key={emoji.char}
                  className="emoji-picker-item"
                  onClick={() => handleEmojiClick(emoji.char)}
                  title={emoji.name}
                  type="button"
                >
                  <span className="picker-emoji-glyph" aria-hidden>
                    {emoji.char}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!error && !loading && !searchResults && (
        <div className="emoji-picker-scroll">
          {groups.map((group) => (
            <div key={group.slug} className="emoji-picker-group">
              <div className="emoji-picker-group-title">{group.name}</div>
              <div className="emoji-picker-grid">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji.char}
                    className="emoji-picker-item"
                    onClick={() => handleEmojiClick(emoji.char)}
                    title={emoji.name}
                    type="button"
                  >
                    <span className="picker-emoji-glyph" aria-hidden>
                      {emoji.char}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
