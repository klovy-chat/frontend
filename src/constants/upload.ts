import i18n from "../i18n/config";

/** Maximum chat attachment size (10 MB) — must match backend `MAX_ATTACHMENT_BYTES`. */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum avatar/banner size (5 MB) — must match backend `MAX_AVATAR_BYTES`. */
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "webp",
  "docx",
  "xlsx",
  "txt",
  "webm",
  "ogg",
  "wav",
] as const;

const ALLOWED_ATTACHMENT_MIME_TYPES: Record<
  (typeof ALLOWED_ATTACHMENT_EXTENSIONS)[number],
  readonly string[]
> = {
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
  webp: ["image/webp"],
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
};

export function formatUploadLimitMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))} MB`;
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

  const mime = file.type.trim().toLowerCase();
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
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error(
      i18n.t("upload.attachmentTooLarge", {
        limit: formatUploadLimitMb(MAX_ATTACHMENT_SIZE_BYTES),
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
