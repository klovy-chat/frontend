import type { ScreenShareCaptureOptions } from "livekit-client";

/** Presety jakości udostępniania ekranu. */
export type ScreenShareQualityId =
  | "balanced"
  | "light"
  | "smooth"
  | "sharp";

export interface ScreenShareQualityPreset {
  id: ScreenShareQualityId;
  /** Szerokość docelowa (ideal — przeglądarka nie upscaluje ponad źródło). */
  width: number;
  height: number;
  frameRate: number;
  /** Wskazówka dla enkodera: tekst vs ruch. */
  contentHint: "detail" | "motion";
}

export const SCREEN_SHARE_QUALITY_PRESETS: Record<
  ScreenShareQualityId,
  ScreenShareQualityPreset
> = {
  /**
   * Domyślny — najlepszy kompromis dla większości:
   * czytelny tekst, umiarkowany transfer, adaptive stream po stronie odbiorcy.
   */
  balanced: {
    id: "balanced",
    width: 1280,
    height: 720,
    frameRate: 30,
    contentHint: "detail",
  },
  /** Słabsze łącze lub słabszy sprzęt odbiorcy. */
  light: {
    id: "light",
    width: 854,
    height: 480,
    frameRate: 30,
    contentHint: "detail",
  },
  /** Gry, wideo, animacje — priorytet płynności. */
  smooth: {
    id: "smooth",
    width: 1280,
    height: 720,
    frameRate: 60,
    contentHint: "motion",
  },
  /** Kod, dokumenty, projektowanie — priorytet ostrości. */
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

/** Ogranicza żądaną rozdzielczość do fizycznego ekranu — bez zbędnego upscalingu. */
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
    video: {
      resolution: { width, height },
      frameRate: preset.frameRate,
      contentHint: preset.contentHint,
    },
  };
}
