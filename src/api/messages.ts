// messages.ts
// HTTP historii, pin, search, upload, link-preview.
// Zakres:
//  - live send idzie WebSocketem, nie tym plikiem
//  - historia, pin, search, upload, link-preview — send jest na WS
// Kształt strony (items, hasMore) musi zgadzać się z messageCache.
// Przy zmianach: controllers/messages.rs, messageCache.ts.

import { apiRequest } from "./client";
import {
  assertAttachmentSize,
  assertAttachmentType,
  normalizeMimeType,
} from "../constants/upload";
import type { LinkPreviewCard } from "../utils/chat/embeds";
import type { Message } from "../types";

export type UploadContext =
  | { type: "dm"; contactId: string }
  | { type: "channel"; channelId: string };

export interface MessagePage {
  messages: Message[];
  hasMore?: boolean;
}

export function getMessages(
  contactId: string,
  opts?: { before?: string; limit?: number },
) {
  return apiRequest<MessagePage>("/api/messages/get-messages", {
    method: "POST",
    body: JSON.stringify({
      id: contactId,
      ...(opts?.before ? { before: opts.before } : {}),
      ...(opts?.limit ? { limit: opts.limit } : {}),
    }),
  });
}

export function fetchLinkPreview(url: string) {
  return apiRequest<LinkPreviewCard>("/api/messages/link-preview", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

export function uploadFile(file: File, context: UploadContext) {
  assertAttachmentSize(file);
  assertAttachmentType(file);
  const form = new FormData();
  form.append("file", file);
  const contentType = normalizeMimeType(file.type);
  if (contentType) {
    form.append("contentType", contentType);
  }
  form.append("contextType", context.type);
  form.append("contextId", context.type === "dm" ? context.contactId : context.channelId);
  return apiRequest<{ filePath: string; scanStatus?: "pending" | "clean" | "blocked" }>(
    "/api/messages/upload-file",
    {
      method: "POST",
      body: form,
    },
  );
}

export function getPinnedMessages(params: { contactId?: string; channelId?: string }) {
  return apiRequest<{ messages: Message[]; canPin?: boolean }>("/api/messages/pinned", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function searchMessages(params: {
  query: string;
  contactId?: string;
  channelId?: string;
}) {
  return apiRequest<{ messages: Message[] }>("/api/messages/search", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export function pinMessageHttp(messageId: string) {
  return apiRequest<{ message: Message }>(`/api/messages/${messageId}/pin`, {
    method: "POST",
  });
}

export function unpinMessageHttp(messageId: string) {
  return apiRequest<{ message: Message }>(`/api/messages/${messageId}/pin`, {
    method: "DELETE",
  });
}
