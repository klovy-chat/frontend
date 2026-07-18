import type { Message } from "../../types";

const VIDEO_EXTENSIONS = new Set(["webm", "mp4", "ogg"]);
const VOICE_NOTE_NAME = /^voice-\d+\.(webm|ogg|mp4|wav|m4a)$/i;

function fileExtension(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function attachmentExtension(message: Pick<Message, "fileName" | "fileUrl">): string {
  return fileExtension(message.fileName ?? message.fileUrl ?? "");
}

export function isRecordedVoiceNote(
  message: Pick<Message, "fileName" | "durationMs">,
): boolean {
  if (message.durationMs != null && message.durationMs > 0) return true;
  return VOICE_NOTE_NAME.test(message.fileName ?? "");
}

export function isVideoAttachment(
  message: Pick<Message, "messageType" | "fileType" | "fileName" | "fileUrl" | "durationMs">,
): boolean {
  if (message.messageType === "VIDEO") return true;

  const mime = message.fileType?.trim().toLowerCase() ?? "";
  if (mime.startsWith("video/")) return true;

  const ext = attachmentExtension(message);
  if (!VIDEO_EXTENSIONS.has(ext)) return false;

  if (message.messageType === "FILE") {
    return ext === "webm" || ext === "mp4" || mime.startsWith("video/");
  }

  if (message.messageType === "AUDIO" && !isRecordedVoiceNote(message)) {
    if (ext === "webm" || ext === "mp4") return true;
    if (ext === "ogg" && mime.startsWith("video/")) return true;
  }

  return false;
}

export function isVoiceAttachment(
  message: Pick<Message, "messageType" | "fileType" | "fileName" | "fileUrl" | "durationMs">,
): boolean {
  return message.messageType === "AUDIO" && !isVideoAttachment(message);
}

export function resolveVideoMimeType(
  fileType?: string,
  fileName?: string,
  fileUrl?: string,
): string | undefined {
  const mime = fileType?.trim().toLowerCase() ?? "";
  if (mime.startsWith("video/")) return mime;

  const ext = fileExtension(fileName ?? fileUrl ?? "");
  if (ext === "mp4") return "video/mp4";
  if (ext === "webm") return "video/webm";
  if (ext === "ogg") return "video/ogg";
  return undefined;
}

export function resolveUploadMessageType(file: File): "IMAGE" | "VIDEO" | "AUDIO" | "FILE" {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = file.type.trim().toLowerCase();

  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  if (mime.startsWith("audio/")) return "AUDIO";

  if (ext === "wav") return "AUDIO";
  if (ext === "mp4") return "VIDEO";
  if (["webm", "ogg"].includes(ext)) return "FILE";

  return "FILE";
}

export function uploadUsesFileNameAsContent(
  messageType: "IMAGE" | "VIDEO" | "AUDIO" | "FILE",
): boolean {
  return messageType !== "AUDIO";
}
