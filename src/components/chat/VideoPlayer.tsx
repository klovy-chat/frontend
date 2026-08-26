// VideoPlayer.tsx
// Wideo z załącznika czatu.
// Zakres:
//  - kontrolki, poster
//  - kontrolki + poster; MIME jak przy uploadzie
// MIME musi przejść file_type na backendzie przy uploadzie.
// Przy zmianach: attachments.ts, MessageBubble.tsx.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { legacyAttachmentFallbackUrl, resolveMediaUrl } from "../../utils/media/media";
import { resolveVideoMimeType } from "../../utils/media/attachments";

interface VideoPlayerProps {
  src: string;
  fileName?: string;
  fileType?: string;
}

export function VideoPlayer({
  src,
  fileName,
  fileType,
}: VideoPlayerProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const primaryUrl = resolveMediaUrl(src);
  const fallbackUrl = legacyAttachmentFallbackUrl(src);
  const [url, setUrl] = useState(primaryUrl);
  const mimeType = resolveVideoMimeType(fileType, fileName, src);

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
        src={mimeType ? undefined : url}
        controls
        playsInline
        preload="metadata"
        aria-label={fileName ?? t("messages.video")}
        onError={() => {
          if (fallbackUrl && url !== fallbackUrl) setUrl(fallbackUrl);
        }}
      >
        {mimeType ? <source src={url} type={mimeType} /> : null}
      </video>
    </div>
  );
}
