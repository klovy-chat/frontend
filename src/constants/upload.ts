// upload.ts
// Limity rozmiaru i liczby uploadów — kontrakt z backendem.
// Zakres:
//  - załącznik, obraz czatu, avatar, banner, etykiety MB
//  - bajty i liczba plików; etykiety MB do UI
// Zmiana limitu bez backendu = ciche 413 u użytkowników.
// Przy zmianach: utils/attachments.rs, utils/upload.rs, MessageInput.tsx.

import i18n from "../i18n/config";
import { ApiError } from "../api/client";

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const MAX_IMAGE_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_BYTES;

export const MAX_AVATAR_SIZE_BYTES = 6 * 1024 * 1024;

export const MAX_BANNER_SIZE_BYTES = 7 * 1024 * 1024;

export const MAX_ATTACHMENT_SIZE_LABEL = `${Math.round(
  MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024),
)} MB`;

export const MAX_IMAGE_ATTACHMENT_SIZE_LABEL = `${Math.round(
  MAX_IMAGE_ATTACHMENT_SIZE_BYTES / (1024 * 1024),
)} MB`;

export const MAX_AVATAR_SIZE_LABEL = `${Math.round(
  MAX_AVATAR_SIZE_BYTES / (1024 * 1024),
)} MB`;

export const MAX_BANNER_SIZE_LABEL = `${Math.round(
  MAX_BANNER_SIZE_BYTES / (1024 * 1024),
)} MB`;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
  "docx",
  "xlsx",
  "pptx",
  "txt",
  "csv",
  "webm",
  "ogg",
  "wav",
  "mp3",
  "aac",
  "m4a",
  "mp4",
  "mov",
] as const;

const IMAGE_ATTACHMENT_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp"]);

const ALLOWED_ATTACHMENT_MIME_TYPES: Record<
  (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number],
  readonly string[]
> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg", "application/octet-stream"],
  jpeg: ["image/jpeg", "application/octet-stream"],
  png: ["image/png", "application/octet-stream"],
  webp: ["image/webp", "application/octet-stream"],
  heic: ["image/heic", "image/heif"],
  heif: ["image/heif", "image/heic"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  txt: ["text/plain"],
  csv: ["text/csv", "text/plain", "application/csv"],

  webm: ["audio/webm", "video/webm"],
  ogg: ["audio/ogg", "video/ogg", "application/ogg"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
  mp3: ["audio/mpeg", "audio/mp3"],
  aac: ["audio/aac", "audio/mp4", "audio/x-m4a"],
  m4a: ["audio/mp4", "audio/aac", "audio/x-m4a"],
  mp4: [
    "audio/mp4",
    "audio/aac",
    "audio/x-m4a",
    "video/mp4",
    "video/quicktime",
    "application/mp4",
  ],
  mov: ["video/quicktime", "video/mp4"],
};

export function formatUploadLimitMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

export function normalizeMimeType(mime: string): string {
  return mime.trim().toLowerCase().split(";")[0]?.trim() ?? "";
}

export function isImageAttachmentFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_ATTACHMENT_EXTENSIONS.has(ext);
}

export function assertAttachmentType(file: File): void {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (
    !ALLOWED_ATTACHMENT_EXTENSIONS.includes(
      ext as (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number],
    )
  ) {
    throw new Error(
      i18n.t("upload.invalidType", {
        extensions: ALLOWED_ATTACHMENT_EXTENSIONS.join(", "),
      }),
    );
  }

  const mime = normalizeMimeType(file.type);
  if (!mime) {
    return;
  }

  const allowedMimes =
    ALLOWED_ATTACHMENT_MIME_TYPES[
      ext as (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number]
    ];
  if (allowedMimes && !allowedMimes.includes(mime)) {
    throw new Error(i18n.t("upload.mimeMismatch"));
  }
}

export function assertAttachmentSize(file: File): void {
  const max = isImageAttachmentFile(file)
    ? MAX_IMAGE_ATTACHMENT_SIZE_BYTES
    : MAX_ATTACHMENT_SIZE_BYTES;
  if (file.size > max) {
    throw new Error(
      i18n.t("upload.attachmentTooLarge", {
        limit: isImageAttachmentFile(file)
          ? MAX_IMAGE_ATTACHMENT_SIZE_LABEL
          : MAX_ATTACHMENT_SIZE_LABEL,
      }),
    );
  }
}

export function assertAvatarSize(file: File): void {
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    throw new Error(
      i18n.t("upload.avatarTooLarge", {
        limit: formatUploadLimitMb(MAX_AVATAR_SIZE_BYTES),
      }),
    );
  }
}

export function assertBannerSize(file: File): void {
  if (file.size > MAX_BANNER_SIZE_BYTES) {
    throw new Error(
      i18n.t("upload.avatarTooLarge", {
        limit: formatUploadLimitMb(MAX_BANNER_SIZE_BYTES),
      }),
    );
  }
}

export const MAX_CHAT_ATTACHMENTS_PER_WINDOW = 20;

export function formatChatUploadError(error: unknown): string {
  if (error instanceof ApiError && error.code === "CHAT_ATTACHMENT_LIMIT") {
    const minutes = Math.max(1, Math.ceil((error.retryAfter ?? 40 * 60) / 60));
    return i18n.t("upload.attachmentLimit", {
      count: MAX_CHAT_ATTACHMENTS_PER_WINDOW,
      minutes,
    });
  }
  if (error instanceof ApiError && error.message.trim()) {
    return error.message;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return i18n.t("upload.failed");
}
