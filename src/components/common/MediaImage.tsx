// MediaImage.tsx
// Img z CDN i fallbackiem na API, cache który URL zadziałał.
// Zakres:
//  - lazy thumbs vs priority lightbox
//  - CDN z fallbackiem API; cache który URL zadziałał
// Nowy kind obrazka: rozwiąż URL w media.ts, nie tutaj.
// Przy zmianach: media.ts, Avatar.tsx, Lightbox.tsx.

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

  fallbackFileUrl?: string;

  deferUntilVisible?: boolean;
}

const resolvedSrcCache = new Map<string, string>();

const MAX_CONCURRENT_LOADS = 10;
let activeLoads = 0;

type LoadWaiter = {
  cancelled: boolean;
  grant: () => void;
};

const loadWaitQueue: LoadWaiter[] = [];

function acquireLoadSlot(): {
  promise: Promise<boolean>;
  cancelWait: () => void;
} {
  if (activeLoads < MAX_CONCURRENT_LOADS) {
    activeLoads += 1;
    return { promise: Promise.resolve(true), cancelWait: () => {} };
  }
  let settle: ((gotSlot: boolean) => void) | null = null;
  const waiter: LoadWaiter = { cancelled: false, grant: () => {} };
  const promise = new Promise<boolean>((resolve) => {
    settle = resolve;
    waiter.grant = () => {
      if (waiter.cancelled) return;
      activeLoads += 1;
      resolve(true);
    };
  });
  loadWaitQueue.push(waiter);
  return {
    promise,
    cancelWait: () => {
      if (waiter.cancelled) return;
      waiter.cancelled = true;
      settle?.(false);
    },
  };
}

function releaseLoadSlot() {
  activeLoads = Math.max(0, activeLoads - 1);
  while (loadWaitQueue.length > 0) {
    const next = loadWaitQueue.shift();
    if (next && !next.cancelled) {
      next.grant();
      return;
    }
  }
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
    if (key.startsWith("blob:")) {
      if (!urls.includes(key)) urls.push(key);
      return;
    }
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
    if (!deferUntilVisible || resolvedSrcCache.has(cacheKey)) {
      setVisible(true);
      return;
    }
    const el = imgRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const root = findScrollRoot(el);
    const reveal = () => setVisible(true);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
          observer.disconnect();
        }
      },
      { root, rootMargin: "240px 0px", threshold: 0 },
    );
    observer.observe(el);
    const fallback = window.setTimeout(reveal, 250);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
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
    let cancelWait = () => {};
    if (resolvedSrcCache.has(cacheKey)) {
      setSlotReady(true);
      setSrc(resolvedSrcCache.get(cacheKey) ?? null);
      return;
    }

    if (!deferUntilVisible) {
      slotHeld.current = false;
      setSlotReady(true);
      setSrc(candidates[0] ?? null);
      return;
    }
    setSlotReady(false);
    const slot = acquireLoadSlot();
    cancelWait = slot.cancelWait;
    void slot.promise.then((gotSlot) => {
      if (cancelled) {
        if (gotSlot) releaseLoadSlot();
        return;
      }
      if (!gotSlot) return;
      slotHeld.current = true;
      setSlotReady(true);
      setSrc(candidates[0] ?? null);
    });
    return () => {
      cancelled = true;
      cancelWait();
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
        return true;
      }
      return false;
    };

    if (markIfReady()) return;
    const frame = window.requestAnimationFrame(markIfReady);
    const retry = window.setTimeout(markIfReady, 50);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
    };
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
