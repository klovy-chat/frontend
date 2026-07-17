import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";

interface ImageCropModalProps {
  file: File;
  /** Output aspect ratio width/height (e.g. 1 for avatar). */
  aspect: number;
  outputWidth: number;
  outputHeight: number;
  title: string;
  /** Human readable max size hint, e.g. "5 MB". */
  maxSizeLabel?: string;
  /** Circular mask for avatars. */
  round?: boolean;
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (file: File) => void | Promise<void>;
  onExportError?: (message: string) => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

/**
 * Lightweight, dependency-free image editor. Lets the user zoom and reposition
 * an image within a fixed-aspect viewport, then exports a cropped/resized file
 * (WebP with JPEG fallback) via canvas.
 */
export function ImageCropModal({
  file,
  aspect,
  outputWidth,
  outputHeight,
  title,
  maxSizeLabel,
  round = false,
  confirmLabel,
  busy = false,
  onCancel,
  onConfirm,
  onExportError,
}: ImageCropModalProps) {
  const { t } = useTranslation();
  const [imageSrc, setImageSrc] = useState<string>("");
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [processing, setProcessing] = useState(false);
  const [exportError, setExportError] = useState("");
  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);

  // Fixed viewport display size (keeps math simple and predictable).
  const viewport = useMemo(() => {
    const maxW = 340;
    const maxH = 340;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    return { w: Math.round(w), h: Math.round(h) };
  }, [aspect]);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const baseScale = useMemo(() => {
    if (!natural) return 1;
    return Math.max(viewport.w / natural.w, viewport.h / natural.h);
  }, [natural, viewport]);

  const scale = baseScale * zoom;

  const clampOffset = useCallback(
    (next: { x: number; y: number }, activeScale: number) => {
      if (!natural) return { x: 0, y: 0 };
      const dispW = natural.w * activeScale;
      const dispH = natural.h * activeScale;
      const maxX = Math.max(0, (dispW - viewport.w) / 2);
      const maxY = Math.max(0, (dispH - viewport.h) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      };
    },
    [natural, viewport],
  );

  useEffect(() => {
    setOffset((prev) => clampOffset(prev, scale));
  }, [scale, clampOffset]);

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (busy || processing) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setOffset(
      clampOffset(
        { x: dragRef.current.baseX + dx, y: dragRef.current.baseY + dy },
        scale,
      ),
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    dragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (busy || processing) return;
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z + delta)));
  };

  const exportBlob = useCallback(async (): Promise<File | null> => {
    if (!natural || !imgRef.current) return null;
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const dispW = natural.w * scale;
    const dispH = natural.h * scale;
    // Top-left of the displayed image relative to the viewport.
    const imgLeft = (viewport.w - dispW) / 2 + offset.x;
    const imgTop = (viewport.h - dispH) / 2 + offset.y;
    // Source rectangle in natural image pixels that maps to the viewport.
    const sx = Math.max(0, -imgLeft / scale);
    const sy = Math.max(0, -imgTop / scale);
    const sWidth = Math.min(natural.w - sx, viewport.w / scale);
    const sHeight = Math.min(natural.h - sy, viewport.h / scale);
    if (sWidth <= 0 || sHeight <= 0) return null;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(
      imgRef.current,
      sx,
      sy,
      sWidth,
      sHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    );

    const toBlob = (type: string, quality: number) =>
      new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), type, quality),
      );

    let blob = await toBlob("image/webp", 0.9);
    let ext = "webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await toBlob("image/jpeg", 0.9);
      ext = "jpg";
    }
    if (!blob) return null;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([blob], `${baseName}.${ext}`, { type: blob.type });
  }, [natural, scale, viewport, offset, outputWidth, outputHeight, file.name]);

  const handleConfirm = async () => {
    if (busy || processing) return;
    setProcessing(true);
    setExportError("");
    try {
      const result = await exportBlob();
      if (result) {
        await onConfirm(result);
      } else {
        const message = t("imageCrop.exportFailed");
        setExportError(message);
        onExportError?.(message);
      }
    } finally {
      setProcessing(false);
    }
  };

  const dispW = natural ? natural.w * scale : 0;
  const dispH = natural ? natural.h * scale : 0;
  const disabled = busy || processing;

  return (
    <div
      className="klovy-backdrop klovy-backdrop--stacked"
      onClick={(e) => {
        if (e.target === e.currentTarget && !disabled) onCancel();
      }}
    >
      <div
        className="klovy-shell"
        style={{
          width: 420,
          maxWidth: "94vw",
          padding: 24,
          background: "var(--bg-elevated, #1c1c22)",
          borderRadius: 16,
          border: "1px solid var(--border, #2b2b33)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: "0 0 6px", color: "var(--text, #f5f5f7)" }}>{title}</h3>
        <p
          style={{
            margin: "0 0 16px",
            fontSize: "0.78rem",
            color: "var(--text-muted, #9a9aa5)",
          }}
        >
          {t("imageCrop.hint")}
          {maxSizeLabel ? ` · ${t("imageCrop.maxSize", { size: maxSizeLabel })}` : ""}
        </p>

        <div
          style={{
            width: viewport.w,
            height: viewport.h,
            margin: "0 auto",
            position: "relative",
            overflow: "hidden",
            borderRadius: round ? "50%" : 12,
            background: "#000",
            touchAction: "none",
            cursor: disabled ? "default" : "grab",
            border: "1px solid var(--border, #2b2b33)",
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          {imageSrc ? (
            <img
              ref={imgRef}
              src={imageSrc}
              alt=""
              draggable={false}
              onLoad={onImageLoad}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: dispW || "auto",
                height: dispH || "auto",
                transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                userSelect: "none",
                pointerEvents: "none",
                maxWidth: "none",
              }}
            />
          ) : null}
        </div>

        {exportError ? (
          <p
            role="alert"
            style={{
              margin: "12px 0 0",
              fontSize: "0.78rem",
              color: "#f87171",
            }}
          >
            {exportError}
          </p>
        ) : null}

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted, #9a9aa5)" }}>
            {t("imageCrop.zoom")}
          </span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={zoom}
            disabled={disabled}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1 }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 18, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="as-btn-secondary"
            disabled={disabled}
            onClick={onCancel}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="as-btn-primary"
            disabled={disabled || !natural}
            onClick={() => void handleConfirm()}
          >
            {disabled ? t("common.saving") : confirmLabel ?? t("imageCrop.apply")}
          </button>
        </div>
      </div>
    </div>
  );
}
