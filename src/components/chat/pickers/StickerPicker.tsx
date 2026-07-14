import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { searchStickers, trendingStickers, type StickerItem } from "../../../api/stickers";
import { ApiError } from "../../../api/client";
import { useLocale } from "../../../context/LocaleContext";
import { isAllowedGifMediaUrl } from "../../../utils/media/mediaAllowlist";
import "../../../styles/pickers/stickerpicker.css";

function isSafeStickerItem(sticker: StickerItem): boolean {
  return isAllowedGifMediaUrl(sticker.url) && isAllowedGifMediaUrl(sticker.preview);
}

interface StickerPickerProps {
  onStickerSelect: (url: string, title: string) => void;
  onClose?: () => void;
}

export function StickerPicker({ onStickerSelect, onClose }: StickerPickerProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const pickerRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [stickers, setStickers] = useState<StickerItem[]>([]);
  const [loading, setLoading] = useState(false);
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
    const query = searchTerm.trim();
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { stickers: result } = query
          ? await searchStickers(query, 24, locale)
          : await trendingStickers(24, locale);
        if (!cancelled) setStickers(result.filter(isSafeStickerItem));
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : t("chat.pickers.sticker.loadFailed");
        setError(message);
        setStickers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(load, query ? 350 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [searchTerm, t, locale]);

  return (
    <div className="sticker-picker" ref={pickerRef}>
      <input
        type="text"
        className="sticker-picker-search"
        placeholder={t("chat.pickers.sticker.searchPlaceholder")}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        autoFocus
      />

      {error && <div className="sticker-picker-error">{error}</div>}

      {loading && <div className="sticker-picker-loading">{t("common.loading")}</div>}

      {!loading && !error && searchTerm.trim() && stickers.length === 0 && (
        <div className="sticker-picker-empty">{t("chat.pickers.sticker.noResults", { term: searchTerm })}</div>
      )}

      {!error && stickers.length > 0 && (
        <div className="sticker-picker-grid">
          {stickers.map((sticker) => (
            <button
              key={sticker.id}
              className="sticker-picker-item"
              onClick={() => {
                if (isAllowedGifMediaUrl(sticker.url)) {
                  onStickerSelect(sticker.url, sticker.title);
                }
              }}
              title={sticker.title}
              type="button"
            >
              {isAllowedGifMediaUrl(sticker.preview) ? (
                <img src={sticker.preview} alt={sticker.title} loading="lazy" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
