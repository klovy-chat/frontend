// VoicePlayer.tsx
// Odtwarzacz notatki głosowej w dymku.
// Zakres:
//  - play/pause, duration
//  - play/pause, duration; format jak z useRecorder
// Format pliku jak przy nagrywaniu (webm/mp4).
// Przy zmianach: useRecorder.ts, bubble.css.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatVoiceDuration } from "../../hooks/useRecorder";
import { legacyAttachmentFallbackUrl, resolveMediaUrl } from "../../utils/media/media";

interface VoicePlayerProps {
  src: string;
  durationMs?: number;
  isOwn?: boolean;
}

export function VoicePlayer({
  src,
  durationMs,
  isOwn = false,
}: VoicePlayerProps) {
  const { t } = useTranslation();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentMs, setCurrentMs] = useState(0);
  const [loadedDurationMs, setLoadedDurationMs] = useState(durationMs ?? 0);

  const primaryUrl = resolveMediaUrl(src);
  const fallbackUrl = legacyAttachmentFallbackUrl(src);
  const [url, setUrl] = useState(primaryUrl);

  useEffect(() => {
    setUrl(primaryUrl);
  }, [primaryUrl]);
  const totalMs = loadedDurationMs || durationMs || 0;

  useEffect(() => {
    setLoadedDurationMs(durationMs ?? 0);
    setProgress(0);
    setCurrentMs(0);
    setPlaying(false);
  }, [url, durationMs]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!audio.duration || !Number.isFinite(audio.duration)) return;
      setCurrentMs(audio.currentTime * 1000);
      setProgress((audio.currentTime / audio.duration) * 100);
    };

    const onLoaded = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setLoadedDurationMs(audio.duration * 1000);
      }
    };

    const onEnded = () => {
      setPlaying(false);
      setProgress(0);
      setCurrentMs(0);
      audio.currentTime = 0;
    };

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
    };
  }, [url]);

  const togglePlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      return;
    }
    void audio.play();
  };

  const displayTime = playing || currentMs > 0 ? currentMs : totalMs;

  if (!url) {
    return (
      <div className="voice-message voice-message--unavailable">
        <span>{t("voice.player.unavailable")}</span>
      </div>
    );
  }

  return (
    <div className={`voice-msg${isOwn ? " voice-msg--own" : ""}`}>
      <button
        type="button"
        className="voice-msg__play"
        onClick={togglePlayback}
        aria-label={playing ? t("voice.player.pause") : t("voice.player.play")}
      >
        {playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="8,5 19,12 8,19" />
          </svg>
        )}
      </button>

      <div className="voice-msg__body">
        <div className="voice-msg__wave" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, index) => (
            <span
              key={index}
              className="voice-msg__bar"
              style={{
                height: `${30 + ((index * 17) % 70)}%`,
                opacity: progress > (index / 28) * 100 ? 1 : 0.35,
              }}
            />
          ))}
          <div
            className="voice-msg__scrub"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="voice-msg__time">{formatVoiceDuration(displayTime)}</span>
      </div>

      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onError={() => {
          if (fallbackUrl && url !== fallbackUrl) setUrl(fallbackUrl);
        }}
      />
    </div>
  );
}
