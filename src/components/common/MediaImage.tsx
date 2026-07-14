import { useEffect, useMemo, useState, type ImgHTMLAttributes } from "react";
import { legacyAttachmentFallbackUrl, resolveMediaUrl } from "../../utils/media/media";

interface MediaImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  fileUrl: string;
}

export function MediaImage({ fileUrl, onError, ...props }: MediaImageProps) {
  const primary = useMemo(() => resolveMediaUrl(fileUrl), [fileUrl]);
  const fallback = useMemo(() => legacyAttachmentFallbackUrl(fileUrl), [fileUrl]);
  const [src, setSrc] = useState(primary);

  useEffect(() => {
    setSrc(primary);
  }, [primary]);

  if (!src) return null;

  return (
    <img
      {...props}
      src={src}
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
