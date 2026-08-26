// screenShare.ts
// Start/stop screenshare LiveKit.
// Zakres:
//  - osobny track
//  - osobny track LiveKit; odmowa przeglądarki = toast
// Przeglądarka może odmówić — pokaż toast, nie crash.
// Przy zmianach: CallView.tsx, CallContext.tsx.

import type { ScreenShareCaptureOptions } from "livekit-client";

export type ScreenShareQualityId =
  | "balanced"
  | "light"
  | "smooth"
  | "sharp";

export interface ScreenShareQualityPreset {
  id: ScreenShareQualityId;

  width: number;
  height: number;
  frameRate: number;

  contentHint: "detail" | "motion";
}

export const SCREEN_SHARE_QUALITY_PRESETS: Record<
  ScreenShareQualityId,
  ScreenShareQualityPreset
> = {

  balanced: {
    id: "balanced",
    width: 1280,
    height: 720,
    frameRate: 30,
    contentHint: "detail",
  },

  light: {
    id: "light",
    width: 854,
    height: 480,
    frameRate: 30,
    contentHint: "detail",
  },

  smooth: {
    id: "smooth",
    width: 1280,
    height: 720,
    frameRate: 60,
    contentHint: "motion",
  },

  sharp: {
    id: "sharp",
    width: 1920,
    height: 1080,
    frameRate: 30,
    contentHint: "detail",
  },
};

export const DEFAULT_SCREEN_SHARE_QUALITY: ScreenShareQualityId = "balanced";

export function isScreenShareQualityId(
  value: unknown,
): value is ScreenShareQualityId {
  return (
    value === "balanced"
    || value === "light"
    || value === "smooth"
    || value === "sharp"
  );
}

function clampToScreen(preset: ScreenShareQualityPreset): {
  width: number;
  height: number;
} {
  if (typeof window === "undefined") {
    return { width: preset.width, height: preset.height };
  }

  const screenW = window.screen?.width ?? preset.width;
  const screenH = window.screen?.height ?? preset.height;

  if (preset.width <= screenW && preset.height <= screenH) {
    return { width: preset.width, height: preset.height };
  }

  const scale = Math.min(screenW / preset.width, screenH / preset.height, 1);
  return {
    width: Math.max(640, Math.round(preset.width * scale)),
    height: Math.max(360, Math.round(preset.height * scale)),
  };
}

export function buildScreenShareCaptureOptions(
  qualityId: ScreenShareQualityId = DEFAULT_SCREEN_SHARE_QUALITY,
): ScreenShareCaptureOptions {
  const preset =
    SCREEN_SHARE_QUALITY_PRESETS[qualityId]
    ?? SCREEN_SHARE_QUALITY_PRESETS[DEFAULT_SCREEN_SHARE_QUALITY];
  const { width, height } = clampToScreen(preset);

  return {
    audio: false,
    video: true,
    resolution: { width, height, frameRate: preset.frameRate },
    contentHint: preset.contentHint,
  };
}
