import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { searchGifs, trendingGifs, type GifItem } from "../../../api/gifs";
import { ApiError } from "../../../api/client";
import { useLocale } from "../../../context/LocaleContext";
import { isAllowedGifMediaUrl } from "../../../utils/media/mediaAllowlist";
import "../../../styles/pickers/gifpicker.css";

function isSafeGifItem(gif: GifItem): boolean {
  return isAllowedGifMediaUrl(gif.url) && isAllowedGifMediaUrl(gif.preview);
}

interface GifPickerProps {
  onGifSelect: (gifUrl: string, gifTitle: string) => void;
  onClose?: () => void;
}

export function GifPicker({ onGifSelect, onClose }: GifPickerProps) {
  const { t } = useTranslation();
  const { locale } = useLocale();
  const pickerRef = useRef<HTMLDivElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [gifs, setGifs] = useState<GifItem[]>([]);
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
        const { gifs: result } = query
          ? await searchGifs(query, 24, locale)
          : await trendingGifs(24, locale);
        if (!cancelled) setGifs(result.filter(isSafeGifItem));
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : t("chat.pickers.gif.loadFailed");
        setError(message);
        setGifs([]);
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
    <div className="gif-picker" ref={pickerRef}>
      <input
        type="text"
        className="gif-picker-search"
        placeholder={t("chat.pickers.gif.searchPlaceholder")}
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        autoFocus
      />

      {error && <div className="gif-picker-error">{error}</div>}

      {loading && <div className="gif-picker-loading">{t("common.loading")}</div>}

      {!loading && !error && searchTerm.trim() && gifs.length === 0 && (
        <div className="gif-picker-empty">{t("chat.pickers.gif.noResults", { term: searchTerm })}</div>
      )}

      {!error && gifs.length > 0 && (
        <div className="gif-picker-grid">
          {gifs.map((gif) => (
            <button
              key={gif.id}
              className="gif-picker-item"
              onClick={() => {
                if (isAllowedGifMediaUrl(gif.url)) {
                  onGifSelect(gif.url, gif.title);
                }
              }}
              title={gif.title}
              type="button"
            >
              {isAllowedGifMediaUrl(gif.preview) ? (
                <img src={gif.preview} alt={gif.title} loading="lazy" />
              ) : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
