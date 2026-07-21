import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ImgHTMLAttributes,
} from "react";
import { legacyAttachmentFallbackUrl, resolveMediaUrl } from "../../utils/media/media";

interface MediaImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  fileUrl: string;
  /** Tried after `fileUrl` (and its CDN→API fallback) fail — e.g. full image when thumb is missing. */
  fallbackFileUrl?: string;
  /**
   * When true (default), defer setting `src` until the image is near the viewport
   * of `.message-list` (or the document if no list root is found).
   */
  deferUntilVisible?: boolean;
}

/** Remember which URL worked for a given file key so remounts don't re-hit the API. */
const resolvedSrcCache = new Map<string, string>();

/** Lazy chat thumbnails share this pool; lightbox uses priority loading instead. */
const MAX_CONCURRENT_LOADS = 10;
let activeLoads = 0;
const loadWaitQueue: Array<() => void> = [];

function acquireLoadSlot(): Promise<void> {
  if (activeLoads < MAX_CONCURRENT_LOADS) {
    activeLoads += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    loadWaitQueue.push(() => {
      activeLoads += 1;
      resolve();
    });
  });
}

function releaseLoadSlot() {
  activeLoads = Math.max(0, activeLoads - 1);
  const next = loadWaitQueue.shift();
  if (next) next();
}

function findScrollRoot(el: HTMLElement | null): Element | null {
  let node: HTMLElement | null = el;
  while (node) {
    if (node.classList?.contains("message-list")) return node;
    node = node.parentElement;
  }
  return null;
}

function buildCandidateUrls(
  fileUrl: string,
  fallbackFileUrl?: string,
): string[] {
  const urls: string[] = [];
  const push = (key: string | null | undefined) => {
    if (!key) return;
    const primary = resolveMediaUrl(key);
    if (primary && !urls.includes(primary)) urls.push(primary);
    const legacy = legacyAttachmentFallbackUrl(key);
    if (legacy && !urls.includes(legacy)) urls.push(legacy);
  };
  push(fileUrl);
  if (fallbackFileUrl && fallbackFileUrl !== fileUrl) {
    push(fallbackFileUrl);
  }
  return urls;
}

export function MediaImage({
  fileUrl,
  fallbackFileUrl,
  onError,
  onLoad,
  deferUntilVisible = true,
  className,
  ...props
}: MediaImageProps) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const candidates = useMemo(
    () => buildCandidateUrls(fileUrl, fallbackFileUrl),
    [fileUrl, fallbackFileUrl],
  );
  const cacheKey = fallbackFileUrl ? `${fileUrl}|${fallbackFileUrl}` : fileUrl;
  const cached = resolvedSrcCache.get(cacheKey);
  const [visible, setVisible] = useState(!deferUntilVisible || Boolean(cached));
  const [slotReady, setSlotReady] = useState(!deferUntilVisible || Boolean(cached));
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [src, setSrc] = useState<string | null>(cached ?? null);
  const slotHeld = useRef(false);

  useEffect(() => {
    if (!deferUntilVisible) {
      setVisible(true);
      return;
    }
    if (resolvedSrcCache.has(cacheKey)) {
      setVisible(true);
      return;
    }
    const el = imgRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const root = findScrollRoot(el);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root, rootMargin: "200px 0px", threshold: 0.01 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cacheKey, deferUntilVisible]);

  useEffect(() => {
    setCandidateIndex(0);
    const hit = resolvedSrcCache.get(cacheKey);
    if (hit) {
      setSrc(hit);
      setSlotReady(true);
      return;
    }
    setSrc(null);
  }, [cacheKey]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    if (resolvedSrcCache.has(cacheKey)) {
      setSlotReady(true);
      setSrc(resolvedSrcCache.get(cacheKey) ?? null);
      return;
    }
    // Lightbox / other eager loads must not wait behind lazy message-list thumbnails.
    if (!deferUntilVisible) {
      slotHeld.current = false;
      setSlotReady(true);
      setSrc(candidates[0] ?? null);
      return;
    }
    setSlotReady(false);
    void acquireLoadSlot().then(() => {
      if (cancelled) {
        releaseLoadSlot();
        return;
      }
      slotHeld.current = true;
      setSlotReady(true);
      setSrc(candidates[0] ?? null);
    });
    return () => {
      cancelled = true;
      if (slotHeld.current) {
        releaseLoadSlot();
        slotHeld.current = false;
      }
    };
  }, [visible, cacheKey, candidates, deferUntilVisible]);

  useEffect(() => {
    if (!slotReady || cached) return;
    setSrc(candidates[candidateIndex] ?? null);
  }, [candidateIndex, candidates, slotReady, cached]);

  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  const loadedSrcRef = useRef<string | null>(null);

  useEffect(() => {
    loadedSrcRef.current = null;
  }, [src, cacheKey]);

  const notifyLoaded = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const key = src ?? cacheKey;
    if (loadedSrcRef.current === key) return;
    loadedSrcRef.current = key;
    if (src) {
      resolvedSrcCache.set(cacheKey, src);
    }
    if (slotHeld.current) {
      releaseLoadSlot();
      slotHeld.current = false;
    }
    onLoadRef.current?.(event);
  }, [src, cacheKey]);

  useEffect(() => {
    const img = imgRef.current;
    if (!img || !src || !slotReady) return;

    const markIfReady = () => {
      if (img.complete && img.naturalWidth > 0) {
        notifyLoaded({ currentTarget: img } as React.SyntheticEvent<HTMLImageElement>);
      }
    };

    markIfReady();
    const frame = window.requestAnimationFrame(markIfReady);
    return () => window.cancelAnimationFrame(frame);
  }, [src, slotReady, notifyLoaded, cacheKey]);

  return (
    <img
      {...props}
      ref={imgRef}
      className={className}
      src={slotReady && src ? src : undefined}
      data-pending={!slotReady || !src ? "true" : undefined}
      onLoad={notifyLoaded}
      onError={(event) => {
        const next = candidateIndex + 1;
        if (next < candidates.length) {
          setCandidateIndex(next);
          return;
        }
        if (slotHeld.current) {
          releaseLoadSlot();
          slotHeld.current = false;
        }
        onError?.(event);
      }}
    />
  );
}
