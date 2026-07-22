import { useEffect, useState } from "react";
import { e2eService } from "./e2eService";
import { resolveMediaUrl } from "../../utils/media/media";
import type { Message } from "../../types";

export function useE2eAttachmentBlobUrl(message: Message): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!message.e2eAttachment || !message.fileUrl) {
      setBlobUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    const run = async () => {
      try {
        const mediaUrl = resolveMediaUrl(message.fileUrl!);
        if (!mediaUrl) return;
        const blob = await e2eService.decryptAttachmentBlob(
          mediaUrl,
          message.e2eAttachment!,
        );
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      } catch {
        if (!cancelled) setBlobUrl(null);
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message._id, message.fileUrl, message.e2eAttachment]);

  return blobUrl;
}
