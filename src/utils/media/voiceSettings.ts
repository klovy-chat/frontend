import i18n from "../../i18n/config";

import type { ScreenShareQualityId } from "../call/screenShareQuality";
import { DEFAULT_SCREEN_SHARE_QUALITY, isScreenShareQualityId } from "../call/screenShareQuality";

const STORAGE_KEY = "klovy.voiceSettings";

export interface VoiceSettings {
  inputDeviceId: string;
  outputDeviceId: string;
  screenShareQuality: ScreenShareQualityId;
}

export type MicrophoneSupportIssue =
  | "insecure"
  | "unsupported"
  | "blocked";

const DEFAULT_SETTINGS: VoiceSettings = {
  inputDeviceId: "",
  outputDeviceId: "",
  screenShareQuality: DEFAULT_SCREEN_SHARE_QUALITY,
};

export function getMicrophoneSupportIssue(): MicrophoneSupportIssue | null {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  if (!navigator.mediaDevices?.getUserMedia) return "unsupported";
  return null;
}

export function describeMicrophoneSupportIssue(
  issue: MicrophoneSupportIssue,
): string {
  switch (issue) {
    case "insecure":
      return i18n.t("voice.insecure");
    case "unsupported":
      return i18n.t("voice.unsupported");
    case "blocked":
      return i18n.t("voice.blocked");
    default:
      return i18n.t("voice.unavailable");
  }
}

export function describeMediaAccessError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
      case "PermissionDeniedError":
        return i18n.t("voice.notAllowed");
      case "NotFoundError":
      case "DevicesNotFoundError":
        return i18n.t("voice.notFound");
      case "NotReadableError":
      case "TrackStartError":
        return i18n.t("voice.notReadable");
      case "SecurityError":
        return i18n.t("voice.securityError");
      case "OverconstrainedError":
        return i18n.t("voice.overconstrained");
      case "AbortError":
        return i18n.t("voice.aborted");
      default:
        return error.message || i18n.t("voice.accessFailed");
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return i18n.t("voice.accessFailed");
}

export async function queryMicrophonePermission(): Promise<PermissionState | null> {
  if (!navigator.permissions?.query) return null;
  try {
    const status = await navigator.permissions.query({
      name: "microphone" as PermissionName,
    });
    return status.state;
  } catch {
    return null;
  }
}

export async function requestMicrophoneAccess(): Promise<MediaStream> {
  const issue = getMicrophoneSupportIssue();
  if (issue) {
    throw new Error(describeMicrophoneSupportIssue(issue));
  }

  try {
    return await navigator.mediaDevices!.getUserMedia({ audio: true });
  } catch (error) {
    if (
      error instanceof DOMException &&
      error.name === "OverconstrainedError"
    ) {
      return navigator.mediaDevices!.getUserMedia({ audio: true });
    }
    throw error;
  }
}

export function releaseMediaStream(stream: MediaStream | null | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

export function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<VoiceSettings>;
    return {
      inputDeviceId:
        typeof parsed.inputDeviceId === "string" ? parsed.inputDeviceId : "",
      outputDeviceId:
        typeof parsed.outputDeviceId === "string" ? parsed.outputDeviceId : "",
      screenShareQuality: isScreenShareQualityId(parsed.screenShareQuality)
        ? parsed.screenShareQuality
        : DEFAULT_SCREEN_SHARE_QUALITY,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveVoiceSettings(settings: VoiceSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function getAudioInputConstraints(): boolean | MediaTrackConstraints {
  const { inputDeviceId } = loadVoiceSettings();
  if (!inputDeviceId || inputDeviceId === "default" || inputDeviceId === "communications") {
    return true;
  }
  return { deviceId: { ideal: inputDeviceId } };
}

type SinkableMediaElement = HTMLMediaElement & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

export async function applyAudioOutputDevice(
  element: HTMLMediaElement,
  deviceId?: string,
): Promise<void> {
  const sinkId = deviceId ?? loadVoiceSettings().outputDeviceId;
  if (!sinkId || sinkId === "default") return;
  const sinkable = element as SinkableMediaElement;
  if (typeof sinkable.setSinkId !== "function") return;
  try {
    await sinkable.setSinkId(sinkId);
  } catch {
    /* ignore unsupported sink */
  }
}

export async function devicesLabeled(): Promise<boolean> {
  if (!navigator.mediaDevices?.enumerateDevices) return false;
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.some(
    (device) =>
      (device.kind === "audioinput" || device.kind === "audiooutput") &&
      device.label.length > 0,
  );
}

export async function listAudioDevices(): Promise<{
  inputs: MediaDeviceInfo[];
  outputs: MediaDeviceInfo[];
  hasLabels: boolean;
}> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return { inputs: [], outputs: [], hasLabels: false };
  }

  const devices = await navigator.mediaDevices.enumerateDevices();
  const inputs = devices.filter((device) => device.kind === "audioinput");
  const outputs = devices.filter((device) => device.kind === "audiooutput");
  const hasLabels = devices.some(
    (device) =>
      (device.kind === "audioinput" || device.kind === "audiooutput") &&
      device.label.length > 0,
  );

  return { inputs, outputs, hasLabels };
}
