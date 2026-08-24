import i18n from "../i18n/config";
import { ApiError } from "../api/client";

/** Maximum non-image chat attachment size (10 MB) — must match backend `MAX_ATTACHMENT_BYTES`. */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum chat image upload size (10 MB) — must match backend `MAX_IMAGE_ATTACHMENT_BYTES`. */
export const MAX_IMAGE_ATTACHMENT_SIZE_BYTES = MAX_ATTACHMENT_SIZE_BYTES;

/** Maximum avatar size (6 MB) — must match backend `MAX_AVATAR_BYTES`. */
export const MAX_AVATAR_SIZE_BYTES = 6 * 1024 * 1024;

/** Maximum profile banner size (7 MB) — must match backend `MAX_BANNER_BYTES`. */
export const MAX_BANNER_SIZE_BYTES = 7 * 1024 * 1024;

/** Human-readable max attachment size, e.g. "10 MB". */
export const MAX_ATTACHMENT_SIZE_LABEL = `${Math.round(
  MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024),
)} MB`;

/** Human-readable max image attachment size, e.g. "10 MB". */
export const MAX_IMAGE_ATTACHMENT_SIZE_LABEL = `${Math.round(
  MAX_IMAGE_ATTACHMENT_SIZE_BYTES / (1024 * 1024),
)} MB`;

/** Human-readable max avatar size, e.g. "6 MB". */
export const MAX_AVATAR_SIZE_LABEL = `${Math.round(
  MAX_AVATAR_SIZE_BYTES / (1024 * 1024),
)} MB`;

/** Human-readable max banner size, e.g. "7 MB". */
export const MAX_BANNER_SIZE_LABEL = `${Math.round(
  MAX_BANNER_SIZE_BYTES / (1024 * 1024),
)} MB`;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "docx",
  "xlsx",
  "txt",
  "webm",
  "ogg",
  "wav",
  "mp4",
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
  gif: ["image/gif", "application/octet-stream"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  xlsx: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  txt: ["text/plain"],
  // Voice notes (MediaRecorder) i przesyłane pliki audio.
  webm: ["audio/webm", "video/webm"],
  ogg: ["audio/ogg", "video/ogg", "application/ogg"],
  wav: ["audio/wav", "audio/x-wav", "audio/wave", "audio/vnd.wave"],
  mp4: [
    "audio/mp4",
    "audio/aac",
    "audio/x-m4a",
    "video/mp4",
    "video/quicktime",
    "application/mp4",
    "application/octet-stream",
  ],
};

export function formatUploadLimitMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

/** Strip parameters such as `;codecs=opus` from a MIME type. */
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

/** Must match backend `MAX_CHAT_ATTACHMENTS_PER_WINDOW`. */
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
