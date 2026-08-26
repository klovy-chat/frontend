// Lightbox.tsx
// Pełny ekran załączników (strzałki, zoom).
// Zakres:
//  - MediaImage z fallbackiem CDN→API
//  - strzałki, zoom; slajdy z tablicy dymka
// Nowe źródło slajdów: tablica LightboxItem z dymka.
// Przy zmianach: MediaImage.tsx, lightbox.css.

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { MediaImage } from "../common/MediaImage";
import { downloadMediaFile } from "../../utils/media/media";
import { useToast } from "../../context/ToastContext";
import "../../styles/chat/lightbox.css";

export interface LightboxItem {
  url: string;
  fileName: string;
  messageId: string;
}

interface LightboxProps {
  items: LightboxItem[];
  initialIndex: number;
  onClose: () => void;
}

const MIN_ZOOM = 25;
const MAX_ZOOM = 400;
const ZOOM_STEP = 10;

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

export function Lightbox({
  items,
  initialIndex,
  onClose,
}: LightboxProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(100);
  const [closing, setClosing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);

  const item = items[index];
  const hasMultiple = items.length > 1;
  const canGoPrev = index > 0;
  const canGoNext = index < items.length - 1;

  const requestClose = useCallback(() => {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  }, [closing, onClose]);

  const goPrev = useCallback(() => {
    if (!canGoPrev) return;
    setIndex((value) => value - 1);
    setZoom(100);
    setImageLoaded(false);
    setImageError(false);
  }, [canGoPrev]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    setIndex((value) => value + 1);
    setZoom(100);
    setImageLoaded(false);
    setImageError(false);
  }, [canGoNext]);

  const adjustZoom = useCallback((delta: number) => {
    setZoom((value) => clampZoom(value + delta));
  }, []);

  const handleDownload = useCallback(async () => {
    if (!item || downloading) return;
    setDownloading(true);
    try {
      await downloadMediaFile(item.url, item.fileName);
    } catch {
      toast.error(t("media.downloadFailed"));
    } finally {
      setDownloading(false);
    }
  }, [downloading, item, toast, t]);

  useEffect(() => {
    setIndex(initialIndex);
    setZoom(100);
    setImageLoaded(false);
    setImageError(false);
    setClosing(false);
  }, [initialIndex, items]);

  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [item?.url, item?.messageId, index]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      adjustZoom(event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP);
    };

    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [adjustZoom]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        goPrev();
        return;
      }
      if (event.key === "ArrowRight") {
        goNext();
        return;
      }
      if (event.key === "+" || event.key === "=") {
        adjustZoom(ZOOM_STEP);
        return;
      }
      if (event.key === "-") {
        adjustZoom(-ZOOM_STEP);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [adjustZoom, goNext, goPrev, requestClose]);

  if (!item) return null;

  return createPortal(
    <div
      className={`image-lightbox klovy-backdrop${closing ? " closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={t("media.lightbox.title")}
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <header className="image-lightbox__toolbar">
        <span className="image-lightbox__filename" title={item.fileName}>
          {item.fileName}
        </span>

        <div className="image-lightbox__controls">
          <button
            type="button"
            className="image-lightbox__btn"
            onClick={() => adjustZoom(-ZOOM_STEP)}
            aria-label={t("media.lightbox.zoomOut")}
            title={t("media.lightbox.zoomOut")}
          >
            <ZoomOut size={18} strokeWidth={2} />
          </button>

          <span className="image-lightbox__zoom-label">{zoom}%</span>

          <button
            type="button"
            className="image-lightbox__btn"
            onClick={() => adjustZoom(ZOOM_STEP)}
            aria-label={t("media.lightbox.zoom")}
            title={t("media.lightbox.zoom")}
          >
            <ZoomIn size={18} strokeWidth={2} />
          </button>

          <span className="image-lightbox__divider" aria-hidden />

          <button
            type="button"
            className="image-lightbox__btn"
            onClick={() => void handleDownload()}
            disabled={downloading}
            aria-label={t("media.lightbox.downloadFile")}
            title={t("common.download")}
          >
            <Download size={18} strokeWidth={2} />
          </button>

          <button
            type="button"
            className="image-lightbox__btn image-lightbox__btn--close"
            onClick={requestClose}
            aria-label={t("common.close")}
            title={t("common.close")}
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>
      </header>

      {hasMultiple && canGoPrev && (
        <button
          type="button"
          className="image-lightbox__nav image-lightbox__nav--prev"
          onClick={goPrev}
          aria-label={t("media.lightbox.previous")}
        >
          <ChevronLeft size={28} strokeWidth={2} />
        </button>
      )}

      {hasMultiple && canGoNext && (
        <button
          type="button"
          className="image-lightbox__nav image-lightbox__nav--next"
          onClick={goNext}
          aria-label={t("media.lightbox.next")}
        >
          <ChevronRight size={28} strokeWidth={2} />
        </button>
      )}

      <div ref={viewportRef} className="image-lightbox__viewport">
        {!imageLoaded && !imageError && (
          <div className="image-lightbox__loader" aria-hidden>
            <div className="spinner" />
          </div>
        )}

        {item.url ? (
        imageError ? (
          <p className="image-lightbox__error">{t("media.lightbox.cannotDisplay")}</p>
        ) : (
        <MediaImage
          key={`${item.messageId}:${item.url}`}
          fileUrl={item.url}
          alt={item.fileName}
          className={`image-lightbox__image${imageLoaded ? " image-lightbox__image--loaded" : ""}`}
          style={{ transform: `scale(${zoom / 100})` }}
          deferUntilVisible={false}
          draggable={false}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageError(true)}
          onClick={(event) => event.stopPropagation()}
        />
        )
        ) : (
          <p className="image-lightbox__error">{t("media.lightbox.cannotDisplay")}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
