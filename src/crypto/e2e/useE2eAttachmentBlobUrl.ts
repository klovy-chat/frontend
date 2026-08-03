import { useEffect, useState } from "react";
import { e2eService } from "./e2eService";
import { resolveMediaUrl } from "../../utils/media/media";
import type { Message } from "../../types";

export type E2eAttachmentBlobState = {
  url: string | null;
  loading: boolean;
  failed: boolean;
};

export function useE2eAttachmentBlobUrl(message: Message): E2eAttachmentBlobState {
  const [state, setState] = useState<E2eAttachmentBlobState>({
    url: null,
    loading: false,
    failed: false,
  });

  useEffect(() => {
    if (!message.e2eAttachment || !message.fileUrl) {
      setState({ url: null, loading: false, failed: false });
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;
    setState({ url: null, loading: true, failed: false });

    const run = async () => {
      try {
        const mediaUrl = resolveMediaUrl(message.fileUrl!);
        if (!mediaUrl) throw new Error("MISSING_MEDIA_URL");
        const blob = await e2eService.decryptAttachmentBlob(
          mediaUrl,
          message.e2eAttachment!,
        );
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setState({ url: objectUrl, loading: false, failed: false });
      } catch {
        if (!cancelled) {
          setState({ url: null, loading: false, failed: true });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [message._id, message.fileUrl, message.e2eAttachment]);

  return state;
}
