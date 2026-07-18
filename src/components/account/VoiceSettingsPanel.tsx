import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../context/ToastContext";
import {
  describeMediaAccessError,
  describeMicrophoneSupportIssue,
  getMicrophoneSupportIssue,
  listAudioDevices,
  loadVoiceSettings,
  queryMicrophonePermission,
  releaseMediaStream,
  requestMicrophoneAccess,
  saveVoiceSettings,
} from "../../utils/media/voiceSettings";
import {
  DEFAULT_SCREEN_SHARE_QUALITY,
  SCREEN_SHARE_QUALITY_PRESETS,
  type ScreenShareQualityId,
} from "../../utils/call/screenShareQuality";

interface AudioDeviceOption {
  deviceId: string;
  label: string;
}

export function VoiceSettingsPanel() {
  const { t } = useTranslation();
  const toast = useToast();
  const supportIssue = getMicrophoneSupportIssue();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [inputDevices, setInputDevices] = useState<AudioDeviceOption[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDeviceOption[]>([]);
  const [inputDeviceId, setInputDeviceId] = useState("");
  const [outputDeviceId, setOutputDeviceId] = useState("");
  const [screenShareQuality, setScreenShareQuality] =
    useState<ScreenShareQualityId>(DEFAULT_SCREEN_SHARE_QUALITY);

  const deviceLabel = useCallback(
    (device: MediaDeviceInfo, index: number): string => {
      if (device.label.trim()) return device.label;
      const kind =
        device.kind === "audioinput"
          ? t("voice.settings.microphone")
          : t("voice.settings.speaker");
      return `${kind} ${index + 1}`;
    },
    [t],
  );

  const refreshDevices = useCallback(async (options?: { keepGranted?: boolean }) => {
    const { inputs, outputs, hasLabels } = await listAudioDevices();

    const inputOptions = inputs.map((device, index) => ({
      deviceId: device.deviceId,
      label: deviceLabel(device, index),
    }));
    const outputOptions = outputs.map((device, index) => ({
      deviceId: device.deviceId,
      label: deviceLabel(device, index),
    }));

    setInputDevices(inputOptions);
    setOutputDevices(outputOptions);

    if (!options?.keepGranted) {
      const permission = await queryMicrophonePermission();
      if (permission === "granted") {
        setPermissionGranted(true);
        setPermissionDenied(false);
      } else if (permission === "denied") {
        setPermissionGranted(false);
        setPermissionDenied(true);
      } else {
        setPermissionGranted(hasLabels);
        setPermissionDenied(false);
      }
    }

    const saved = loadVoiceSettings();
    const nextInput =
      inputOptions.find((item) => item.deviceId === saved.inputDeviceId)?.deviceId ??
      inputOptions[0]?.deviceId ??
      "";
    const nextOutput =
      outputOptions.find((item) => item.deviceId === saved.outputDeviceId)?.deviceId ??
      outputOptions[0]?.deviceId ??
      "";

    setInputDeviceId(nextInput);
    setOutputDeviceId(nextOutput);
    setScreenShareQuality(saved.screenShareQuality);
    saveVoiceSettings({
      inputDeviceId: nextInput,
      outputDeviceId: nextOutput,
      screenShareQuality: saved.screenShareQuality,
    });
  }, [deviceLabel]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await refreshDevices();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const onDeviceChange = () => {
      void refreshDevices({ keepGranted: permissionGranted });
    };
    navigator.mediaDevices?.addEventListener("devicechange", onDeviceChange);
    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener("devicechange", onDeviceChange);
    };
  }, [permissionGranted, refreshDevices]);

  const handleGrantPermissions = async () => {
    if (supportIssue) {
      toast.error(describeMicrophoneSupportIssue(supportIssue));
      return;
    }

    setBusy(true);
    setPermissionDenied(false);
    let stream: MediaStream | null = null;
    try {
      stream = await requestMicrophoneAccess();
      setPermissionGranted(true);
      await refreshDevices({ keepGranted: true });
      toast.success(t("voice.settings.permissionsGranted"));
    } catch (error) {
      const message = describeMediaAccessError(error);
      setPermissionGranted(false);
      setPermissionDenied(true);
      toast.error(message);
    } finally {
      releaseMediaStream(stream);
      setBusy(false);
    }
  };

  const persistSettings = useCallback(
    (next: {
      inputDeviceId?: string;
      outputDeviceId?: string;
      screenShareQuality?: ScreenShareQualityId;
    }) => {
      saveVoiceSettings({
        inputDeviceId: next.inputDeviceId ?? inputDeviceId,
        outputDeviceId: next.outputDeviceId ?? outputDeviceId,
        screenShareQuality: next.screenShareQuality ?? screenShareQuality,
      });
    },
    [inputDeviceId, outputDeviceId, screenShareQuality],
  );

  const handleInputChange = (value: string) => {
    setInputDeviceId(value);
    persistSettings({ inputDeviceId: value });
  };

  const handleOutputChange = (value: string) => {
    setOutputDeviceId(value);
    persistSettings({ outputDeviceId: value });
  };

  const handleScreenShareQualityChange = (value: ScreenShareQualityId) => {
    setScreenShareQuality(value);
    persistSettings({ screenShareQuality: value });
  };

  const outputSupported =
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype;

  const needsPermission = !permissionGranted && !loading;

  return (
    <>
      <h2 className="as-section-title">{t("voice.settings.title")}</h2>
      <p className="as-section-subtitle">{t("voice.settings.subtitle")}</p>

      {supportIssue ? (
        <div className="as-voice-banner as-voice-banner--error" role="alert">
          <span className="as-voice-banner__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <span>{describeMicrophoneSupportIssue(supportIssue)}</span>
        </div>
      ) : (
        <div className="as-voice-banner as-voice-banner--info" role="status">
          <span className="as-voice-banner__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
          <span>{t("voice.settings.infoBanner")}</span>
        </div>
      )}

      {needsPermission ? (
        <div className="as-voice-banner as-voice-banner--error" role="alert">
          <span className="as-voice-banner__icon" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <span>
            {permissionDenied
              ? t("voice.settings.permissionsBlocked")
              : t("voice.settings.permissionsRequired")}
          </span>
        </div>
      ) : null}

      <div className="as-card as-voice-card">
        <div className="as-field">
          <label htmlFor="voice-input-device">{t("voice.settings.microphone")}</label>
          <select
            id="voice-input-device"
            className="as-select"
            value={inputDeviceId}
            disabled={loading || !permissionGranted || inputDevices.length === 0}
            onChange={(e) => handleInputChange(e.target.value)}
          >
            {inputDevices.length === 0 ? (
              <option value="">{t("voice.settings.noDevices")}</option>
            ) : (
              inputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))
            )}
          </select>
        </div>

        <div className="as-field as-voice-field-spaced">
          <label htmlFor="voice-output-device">
            {t("voice.settings.speakers")} / {t("voice.settings.headphones")}
          </label>
          <select
            id="voice-output-device"
            className="as-select"
            value={outputDeviceId}
            disabled={
              loading ||
              !permissionGranted ||
              !outputSupported ||
              outputDevices.length === 0
            }
            onChange={(e) => handleOutputChange(e.target.value)}
          >
            {outputDevices.length === 0 ? (
              <option value="">{t("voice.settings.noDevices")}</option>
            ) : (
              outputDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))
            )}
          </select>
          {!outputSupported ? (
            <p className="as-voice-hint">{t("voice.settings.outputUnsupported")}</p>
          ) : null}
        </div>

        <div className="as-field as-voice-field-spaced">
          <label htmlFor="voice-screen-share-quality">
            {t("voice.settings.screenShareQuality")}
          </label>
          <select
            id="voice-screen-share-quality"
            className="as-select"
            value={screenShareQuality}
            disabled={loading}
            onChange={(e) =>
              handleScreenShareQualityChange(e.target.value as ScreenShareQualityId)
            }
          >
            {(Object.keys(SCREEN_SHARE_QUALITY_PRESETS) as ScreenShareQualityId[]).map(
              (id) => (
                <option key={id} value={id}>
                  {t(`voice.settings.screenShareQualityOptions.${id}`)}
                </option>
              ),
            )}
          </select>
          <p className="as-voice-hint">
            {t(`voice.settings.screenShareQualityHints.${screenShareQuality}`)}
          </p>
        </div>

        {needsPermission && !supportIssue ? (
          <button
            type="button"
            className="as-btn-primary as-voice-permission-btn"
            disabled={busy}
            onClick={() => void handleGrantPermissions()}
          >
            {busy ? t("common.loading") : t("voice.settings.grantPermissions")}
          </button>
        ) : null}
      </div>

      <p className="as-voice-footer">{t("voice.settings.codecInfo")}</p>
    </>
  );
}
