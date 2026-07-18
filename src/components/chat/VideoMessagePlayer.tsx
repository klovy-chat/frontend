import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { legacyAttachmentFallbackUrl, resolveMediaUrl } from "../../utils/media/media";

interface VideoMessagePlayerProps {
  src: string;
  fileName?: string;
}

export function VideoMessagePlayer({
  src,
  fileName,
}: VideoMessagePlayerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const primaryUrl = resolveMediaUrl(src);
  const fallbackUrl = legacyAttachmentFallbackUrl(src);
  const [url, setUrl] = useState(primaryUrl);

  useEffect(() => {
    setUrl(primaryUrl);
  }, [primaryUrl]);

  if (!url) {
    return (
      <div className="video-msg video-msg--unavailable">
        <span>{t("messages.videoUnavailable")}</span>
      </div>
    );
  }

  return (
    <div className="video-msg">
      <video
        ref={videoRef}
        className="video-msg__player"
        src={url}
        controls
        playsInline
        preload="metadata"
        aria-label={fileName ?? t("messages.video")}
        onError={() => {
          if (fallbackUrl && url !== fallbackUrl) setUrl(fallbackUrl);
        }}
      />
    </div>
  );
}
