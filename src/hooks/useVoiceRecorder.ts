import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  describeMediaAccessError,
  getAudioInputConstraints,
} from "../utils/media/voiceSettings";

const MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  // Safari / iOS only support MP4 (AAC) for MediaRecorder — without these,
  // recording silently "did nothing" on those browsers in production.
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/aac",
];

const MAX_VOICE_DURATION_MS = 5 * 60 * 1000;

function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  return MIME_TYPES.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

function extensionForMime(mime: string): string {
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp4") || mime.includes("aac") || mime.includes("m4a"))
    return "mp4";
  return "webm";
}

export interface VoiceRecordingResult {
  file: File;
  durationMs: number;
}

export function useVoiceRecorder(maxDurationMs = MAX_VOICE_DURATION_MS) {
  const { t } = useTranslation();
  const [isRecording, setIsRecording] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const startedAtRef = useRef(0);
  const stopResolveRef = useRef<
    ((value: VoiceRecordingResult | null) => void) | null
  >(null);

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const reset = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = undefined;
    chunksRef.current = [];
    recorderRef.current = null;
    setIsRecording(false);
    setDurationMs(0);
    cleanupStream();
  }, [cleanupStream]);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      stopResolveRef.current = null;
      recorder.onstop = () => reset();
      recorder.stop();
    } else {
      reset();
    }
    setError(null);
  }, [reset]);

  const stop = useCallback((): Promise<VoiceRecordingResult | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        reset();
        return;
      }
      stopResolveRef.current = resolve;
      if (timerRef.current) clearInterval(timerRef.current);
      recorder.stop();
    });
  }, [reset]);

  const start = useCallback(async (): Promise<boolean> => {
    setError(null);
    const mime = pickMimeType();
    if (!mime) {
      setError(t("voice.recorder.unsupported"));
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(t("voice.recorder.insecure"));
      return false;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: getAudioInputConstraints(),
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === "OverconstrainedError") {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw err;
        }
      }
      streamRef.current = stream;
      mimeRef.current = mime;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const resolve = stopResolveRef.current;
        stopResolveRef.current = null;
        const chunks = chunksRef.current;
        const recordedMs = Date.now() - startedAtRef.current;
        const mimeType = mimeRef.current;

        cleanupStream();

        if (!resolve) {
          reset();
          return;
        }

        if (chunks.length === 0 || recordedMs < 500) {
          resolve(null);
          reset();
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });
        const ext = extensionForMime(mimeType);
        const file = new File([blob], `voice-${Date.now()}.${ext}`, {
          type: mimeType,
        });
        resolve({
          file,
          durationMs: Math.min(recordedMs, maxDurationMs),
        });
        reset();
      };

      recorder.onerror = () => {
        setError(t("voice.recorder.failed"));
        void cancel();
      };

      startedAtRef.current = Date.now();
      recorder.start(250);
      setIsRecording(true);
      setDurationMs(0);

      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setDurationMs(elapsed);
        if (elapsed >= maxDurationMs) {
          void stop();
        }
      }, 200);

      return true;
    } catch (err) {
      setError(describeMediaAccessError(err));
      reset();
      return false;
    }
  }, [cancel, cleanupStream, maxDurationMs, reset, stop, t]);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  return { isRecording, durationMs, error, start, stop, cancel, setError };
}

export function formatVoiceDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
