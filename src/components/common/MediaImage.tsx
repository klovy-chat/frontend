import { useEffect, useMemo, useState, type ImgHTMLAttributes } from "react";
import { legacyAttachmentFallbackUrl, resolveMediaUrl } from "../../utils/media/media";

interface MediaImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  fileUrl: string;
}

/** Remember which URL worked for a given file key so remounts don't re-hit the API. */
const resolvedSrcCache = new Map<string, string>();

export function MediaImage({ fileUrl, onError, ...props }: MediaImageProps) {
  const primary = useMemo(() => resolveMediaUrl(fileUrl), [fileUrl]);
  const fallback = useMemo(() => legacyAttachmentFallbackUrl(fileUrl), [fileUrl]);
  const cached = resolvedSrcCache.get(fileUrl);
  const [src, setSrc] = useState(cached ?? primary);

  useEffect(() => {
    setSrc(resolvedSrcCache.get(fileUrl) ?? primary);
  }, [fileUrl, primary]);

  if (!src) return null;

  return (
    <img
      {...props}
      src={src}
      onLoad={() => {
        resolvedSrcCache.set(fileUrl, src);
      }}
      onError={(event) => {
        if (fallback && src !== fallback) {
          setSrc(fallback);
          return;
        }
        onError?.(event);
      }}
    />
  );
}
