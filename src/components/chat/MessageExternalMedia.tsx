import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { MediaImage } from "../common/MediaImage";
import {
  extractExternalMediaLinks,
  isOnlyExternalMediaContent,
} from "../../utils/media/externalMediaLinks";

interface MessageExternalMediaProps {
  content: string;
  onImageClick?: (url: string, fileName: string) => void;
}

export function MessageExternalMedia({
  content,
  onImageClick,
}: MessageExternalMediaProps) {
  const { t } = useTranslation();
  const mediaLinks = useMemo(
    () => extractExternalMediaLinks(content),
    [content],
  );

  if (mediaLinks.length === 0) {
    return null;
  }

  return (
    <div className="message-external-media">
      {mediaLinks.map((media) => (
        <button
          key={media.url}
          type="button"
          className="message-image-container"
          onClick={() => onImageClick?.(media.url, media.fileName)}
          aria-label={t("messages.actions.openPreview", {
            name: media.fileName,
          })}
        >
          <MediaImage
            fileUrl={media.url}
            alt={media.fileName}
            className={`message-image${media.kind === "gif" ? " message-image--gif" : ""}`}
            decoding="async"
          />
        </button>
      ))}
    </div>
  );
}

export function shouldHideTextForExternalMedia(content: string): boolean {
  return isOnlyExternalMediaContent(content);
}
